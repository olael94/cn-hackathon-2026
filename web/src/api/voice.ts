import { useEffect, useEffectEvent, useState } from 'react'
import { z } from 'zod'
import type { CapturePosition, Segment } from '@/api/contract'
import { speakerToken } from '@/api/replay'
import { demoPath } from '@/api/demo'
import { liveSpeaker, saveSpeaker, talksUrl } from '@/api/liveTalk'

const base = talksUrl + '/'
const segment = z.object({
  id: z.string(), talk_id: z.string(), seq: z.number().int(), t_start: z.number(),
  t_end: z.number(), text_en: z.string(), text_es: z.string().nullable(), emitted_at: z.string(),
  captured_at: z.string().nullish(),
}) satisfies z.ZodType<Segment>
const capturePosition = z.object({seq: z.number().int().nonnegative(), elapsed: z.number().nonnegative()}) satisfies z.ZodType<CapturePosition>

async function readPosition(id: string, headers: Record<string, string>, savedNext?: number): Promise<CapturePosition> {
  const response = await fetch(base + id + '/capture', {headers, cache: 'no-store'})
  if (response.ok) {
    const position = capturePosition.parse(await response.json())
    return {...position, seq: Math.max(savedNext ?? 0, position.seq)}
  }
  // Older deployed APIs have no capture endpoint. Migrate a saved session using its archived audio.
  if (response.status === 404 && savedNext !== undefined) {
    let seq = -1
    let elapsed = 0
    for (;;) {
      const history = await fetch(base + id + '/segments?after_seq=' + seq, {cache: 'no-store'})
      if (!history.ok) break
      const rows = z.array(segment).parse(await history.json())
      const last = rows.at(-1)
      if (last) { elapsed = last.t_end; seq = last.seq }
      if (rows.length < 1000) return {seq: Math.max(savedNext, seq + 1), elapsed}
    }
  }
  throw new Error('Open the browser that started this talk to capture voice.')
}

export function useVoiceCaptions(id: string | null | undefined, ended: boolean) {
  const [feed, setFeed] = useState<{id: string; lines: Segment[]; connected: boolean}>()
  const talkEnded = useEffectEvent(() => ended)
  useEffect(() => {
    if (!id) return
    const talkId = id
    const history = new AbortController()
    let newest = -1
    let lastProgress = performance.now()
    let loading = false
    const received = new Set<number>()
    function receive(rows: Segment[]) {
      if (history.signal.aborted) return
      const missing = rows.filter(row => row.talk_id === id && !received.has(row.seq))
      if (!missing.length) return
      for (const row of missing) {
        received.add(row.seq)
        newest = Math.max(newest, row.seq)
      }
      lastProgress = performance.now()
      setFeed(previous => {
        const lines = previous?.id === talkId ? previous.lines : []
        const merged = [...lines, ...missing]
        if (lines.length && missing[0].seq < lines[lines.length - 1].seq) merged.sort((a, b) => a.seq - b.seq)
        return {id: talkId, connected: true, lines: merged}
      })
    }
    async function catchUp() {
      if (loading || history.signal.aborted) return
      loading = true
      const finalRead = talkEnded()
      let cursor = newest
      try {
        const signal = AbortSignal.any([history.signal, AbortSignal.timeout(10000)])
        for (;;) {
          const response = await fetch(base + talkId + '/segments?after_seq=' + cursor, {cache: 'no-store', signal})
          if (!response.ok) throw new Error('Caption history HTTP ' + response.status)
          const rows = z.array(segment).parse(await response.json())
          receive(rows)
          const next = rows.at(-1)?.seq
          if (rows.length < 1000 || next === undefined || next <= cursor) break
          cursor = next
        }
        if (finalRead) window.clearInterval(timer)
      } catch (error) {
        if (!history.signal.aborted) console.warn('Caption history unavailable', error)
      } finally {
        loading = false
      }
    }
    const source = new EventSource(base + id + '/events')
    const connection = (connected: boolean) => setFeed(previous => ({
      id, connected, lines: previous?.id === id ? previous.lines : [],
    }))
    source.onopen = () => connection(true)
    source.onerror = () => connection(false)
    source.addEventListener('segment', (event: MessageEvent<string>) => {
      receive([segment.parse(JSON.parse(event.data))])
    })
    // A proxy can leave an SSE connection open even after it stops delivering captions.
    const timer = window.setInterval(() => {
      if (talkEnded() || performance.now() - lastProgress >= 8000) void catchUp()
    }, 5000)
    return () => {
      window.clearInterval(timer)
      history.abort()
      source.close()
    }
  }, [id])
  return feed?.id === id ? feed : undefined
}

export function voiceFormat() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
}

async function uploadChunk(id: string, headers: Record<string, string>, body: FormData) {
  // Retries keep the original seq and timestamp. The backend deduplicates by talk and seq.
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: Response | undefined
    try {
      response = await fetch(base + id + '/audio', {
        method: 'POST', headers, body, signal: AbortSignal.timeout(4000),
      })
    } catch (error) {
      console.warn('Audio upload interrupted', id, body.get('seq'), attempt, error)
    }
    if (response?.ok) return
    if (response) {
      const {status} = response
      console.warn('Audio upload rejected', id, body.get('seq'), attempt, status)
      if (status === 401 || status === 403) throw new Error('Open the browser that started this talk to capture voice.')
      if (status === 404 || status === 409) throw new Error('This talk is no longer available for audio uploads.')
      if (status < 500 && status !== 408 && status !== 429) throw new Error('The caption service rejected this audio segment.')
      if (attempt === 3) throw new Error('The caption service is temporarily unavailable. Reconnect to resume uploads.')
    }
    if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, 350 * attempt))
  }
  throw new Error('Audio upload paused after three attempts. Check your connection and reconnect.')
}

export async function recordVoice(stream: MediaStream, id: string, fail: (message: string) => void) {
  const mimeType = voiceFormat()
  if (!mimeType) throw new Error('This browser cannot record voice. Use Safari or Chrome.')
  const filename = mimeType.includes('mp4') ? 'voice.mp4' : 'voice.webm'
  const session = liveSpeaker(id)
  const headers = { 'X-Speaker-Token': session?.token ?? speakerToken() }
  const position = session?.elapsed !== undefined
    ? {seq: session.next, elapsed: session.elapsed}
    : await readPosition(id, headers, session?.next)
  const sent = performance.now()
  const response = await fetch(demoPath + '/replay', {cache: 'no-store'})
  if (!response.ok) throw new Error('Could not reach the room. Check your connection and try again.')
  const room = z.object({server_ms: z.number(), voice_id: z.literal(id)}).parse(await response.json())
  const clockAnchor = (sent + performance.now()) / 2
  let {seq, elapsed} = position
  let stopping = false
  let failed = false
  const uploads = new Set<Promise<void>>()
  let recorder: MediaRecorder
  let stoppedAt: number | undefined
  let timer: number
  let resolveStop: () => void
  const finished = new Promise<void>(resolve => { resolveStop = resolve })

  function stopChunk() {
    if (recorder.state === 'inactive') return
    stoppedAt = performance.now()
    recorder.stop()
  }

  function abort(message: string) {
    if (failed) return
    failed = true
    stopping = true
    window.clearTimeout(timer)
    stopChunk()
    fail(message)
  }
  function capture() {
    recorder = new MediaRecorder(stream, {mimeType})
    const chunks: Blob[] = []
    stoppedAt = undefined
    const startedAt = performance.now()
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => abort('Audio capture was interrupted. Reconnect the audio source.')
    recorder.onstop = () => {
      window.clearTimeout(timer)
      if (chunks.length && !failed) {
        const endedAt = stoppedAt ?? performance.now()
        const start = elapsed
        elapsed += (endedAt - startedAt) / 1000
        const number = seq++
        if (session) saveSpeaker({...session, next: seq, elapsed})
        const file = new Blob(chunks, {type: mimeType})
        const body = new FormData()
        body.set('file', file, filename)
        body.set('seq', String(number))
        body.set('t_start', String(start))
        body.set('t_end', String(elapsed))
        body.set('captured_at', new Date(room.server_ms + endedAt - clockAnchor).toISOString())
        // The server orders captions by seq. A slow acknowledgement can overlap the next upload.
        const upload = uploadChunk(id, headers, body)
          .catch((error: Error) => abort(error.message))
          .finally(() => { uploads.delete(upload) })
        uploads.add(upload)
      }
      if (uploads.size > 3) abort('Connection too slow for voice capture. Reconnect to continue.')
      if (stopping || !stream.active) void Promise.all(uploads).then(resolveStop)
      else capture()
    }
    recorder.start()
    timer = window.setTimeout(stopChunk, 5000)
  }
  if (!stream.active) throw new Error('The audio source disconnected.')
  capture()
  return () => {
    stopping = true
    window.clearTimeout(timer)
    stopChunk()
    return finished
  }
}
