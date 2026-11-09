import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { Segment } from '@/api/contract'
import { speakerToken } from '@/api/replay'

const base = (import.meta.env.VITE_API_URL ?? '/api') + '/talks/'
const segment = z.object({
  id: z.string(), talk_id: z.string(), seq: z.number().int(), t_start: z.number(),
  t_end: z.number(), text_en: z.string(), text_es: z.string().nullable(), emitted_at: z.string(),
}) satisfies z.ZodType<Segment>

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
  const headers = { 'X-Speaker-Token': speakerToken() }
  const response = await fetch(base + id + '/capture', {headers, cache: 'no-store'})
  if (!response.ok) throw new Error('Open the browser that started this talk to capture voice.')
  const position = z.object({seq: z.number().int(), elapsed: z.number()}).parse(await response.json())
  const anchor = performance.now()
  const elapsed = () => position.elapsed + (performance.now() - anchor) / 1000
  let seq = position.seq
  let stopping = false
  let lastUpload = Promise.resolve()
  let recorder: MediaRecorder
  let timer: number
  let pending = 0
  let resolveStop: () => void
  const finished = new Promise<void>(resolve => { resolveStop = resolve })

  function abort(message: string) {
    if (stopping) return
    stopping = true
    window.clearTimeout(timer)
    if (recorder.state !== 'inactive') recorder.stop()
    fail(message)
  }
  function capture() {
    recorder = new MediaRecorder(stream, {mimeType})
    const chunks: Blob[] = []
    const start = elapsed()
    const number = seq++
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => abort('Voice capture was interrupted. Reconnect your microphone.')
    recorder.onstop = () => {
      window.clearTimeout(timer)
      const end = elapsed()
      if (chunks.length) {
        const file = new Blob(chunks, {type: mimeType})
        const body = new FormData()
        body.set('file', file, filename)
        body.set('seq', String(number))
        body.set('t_start', String(start))
        body.set('t_end', String(end))
        pending++
        lastUpload = lastUpload.then(async () => {
          const res = await fetch(base + id + '/audio', {method:'POST', headers, body, signal: AbortSignal.timeout(12000)})
          if (!res.ok) throw new Error('Upload failed')
        }).catch(() => {
          const message = 'A voice segment could not be sent. Check your connection.'
          if (stopping) fail(message)
          else abort(message)
        }).finally(() => { pending-- })
      }
      if (pending >= 3) abort('Connection too slow for voice capture. Reconnect to continue.')
      if (stopping || !stream.active) void lastUpload.then(resolveStop)
      else capture()
    }
    recorder.start()
    timer = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, 5000)
  }
  if (!stream.active) throw new Error('The microphone disconnected.')
  capture()
  return () => {
    stopping = true
    window.clearTimeout(timer)
    if (recorder.state !== 'inactive') recorder.stop()
    return finished
  }
}
