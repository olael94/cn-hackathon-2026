import { useEffect, useState } from 'react'
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

export function useVoiceCaptions(id?: string | null) {
  const [feed, setFeed] = useState<{id: string; lines: Segment[]; connected: boolean}>()
  useEffect(() => {
    if (!id) return
    const source = new EventSource(base + id + '/events')
    const connection = (connected: boolean) => setFeed(previous => ({
      id, connected, lines: previous?.id === id ? previous.lines : [],
    }))
    source.onopen = () => connection(true)
    source.onerror = () => connection(false)
    source.addEventListener('segment', (event: MessageEvent<string>) => {
      const line = segment.parse(JSON.parse(event.data))
      if (line.talk_id !== id) return
      setFeed(previous => {
        const lines = previous?.id === id ? previous.lines : []
        if (lines.length && lines[lines.length - 1].seq >= line.seq) return previous
        return {id, connected: true, lines: [...lines, line]}
      })
    })
    return () => source.close()
  }, [id])
  return feed?.id === id ? feed : undefined
}

export function voiceFormat() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type))
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
    if (stopping) return
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
      if (chunks.length) {
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
        const upload = fetch(base + id + '/audio', {
          method: 'POST', headers, body, signal: AbortSignal.timeout(12000),
        }).then(res => {
          if (!res.ok) throw new Error('Upload failed')
        }).catch(() => {
          const message = 'A voice segment could not be sent. Check your connection.'
          if (stopping) fail(message)
          else abort(message)
        }).finally(() => { uploads.delete(upload) })
        uploads.add(upload)
      }
      if (uploads.size >= 3) abort('Connection too slow for voice capture. Reconnect to continue.')
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
