import { useEffect, useState } from 'react'
import { demoRoom } from '@/api/demo'
import { useReplay } from '@/api/replay'
import { useVoiceCaptions } from '@/api/voice'

import captions from './replayCaptions.json'
export { captions }

const transcriptKey = 'roompass:demo:transcript:' + demoRoom

export function useDemoRoom(speaker: boolean, language: 'en' | 'es') {
  const { state, control } = useReplay()
  const [clockTick, setClockTick] = useState(0)
  const [savedStart, setSavedStart] = useState(() => {
    try { return localStorage.getItem(transcriptKey) } catch { return null }
  })
  const session = state.data
  const voiceId = session?.voice_id
  const feed = useVoiceCaptions(voiceId)
  const disconnected = state.isError || state.fetchStatus === 'paused'
  const now = session
    ? session.server_ms + Math.max(0, clockTick - session.anchor)
    : 0
  const started = session?.started_ms ?? null
  const stopped = session?.stopped_ms ?? null
  const finish = stopped === null ? null : stopped + 5000
  const phase: 'waiting' | 'live' | 'draining' | 'ended' = started === null ? 'waiting'
    : finish === null ? 'live' : now < finish ? 'draining' : 'ended'
  const until = Math.min(now, finish ?? Infinity)
  const count = started === null ? 0 : Math.max(0, 1 + Math.floor((until - started - 2000) / 8000))
  const visible = voiceId ? (feed?.lines ?? []).map(line => ({
    id: line.seq,
    time: new Date(Math.floor(line.t_end) * 1000).toISOString().slice(11, 19),
    en: line.text_en, es: line.text_es ?? line.text_en,
    translationMissing: !line.text_es,
    lag: Math.max(0, (Date.parse(line.emitted_at) - (line.captured_at
      ? Date.parse(line.captured_at) : (started ?? 0) + line.t_end * 1000)) / 1000),
  })) : captions.slice(0, count)
  const nextCaption = started !== null && count < captions.length ? started + 2000 + count * 8000 : Infinity
  const nextChange = Math.min(nextCaption, finish !== null && now < finish ? finish : Infinity)
  useEffect(() => {
    if (!session || disconnected || phase === 'ended' || !Number.isFinite(nextChange)) return
    const delay = nextChange - session.server_ms - (performance.now() - session.anchor)
    const timer = window.setTimeout(() => setClockTick(performance.now()), Math.max(1, Math.ceil(delay)))
    return () => clearTimeout(timer)
  }, [session, disconnected, phase, nextChange])

  const badge = disconnected ? 'Reconnecting'
    : !session ? 'Connecting to room'
    : phase === 'waiting' ? 'Waiting for speaker'
    : phase === 'draining' ? 'Finishing captions'
    : phase === 'ended' ? 'Talk ended'
    : voiceId ? (!feed?.connected ? 'Connecting to captions' : visible.length ? null : 'Listening for speech')
    : !count ? 'Waiting for first caption'
    : now >= (started ?? 0) + 2000 + captions.length * 8000 ? 'Sample complete'
    : null

  async function start(save: boolean, voice: boolean) {
    const next = await control.mutateAsync(voice ? 'voice' : 'start')
    const value = save ? String(next.started_ms) : null
    setSavedStart(value)
    try {
      if (value) localStorage.setItem(transcriptKey, value)
      else localStorage.removeItem(transcriptKey)
    } catch { /* The download stays available during this visit. */ }
    return next.voice_id ?? null
  }
  return {
    voiceId, phase, visible, badge, latest: visible.at(-1), start,
    ready: Boolean(session) && !disconnected && !control.isPending,
    controlError: control.isError
      ? (control.error instanceof TypeError ? 'Could not reach the room. Check your connection and try again.' : control.error.message)
      : null,
    stop: () => control.mutate('stop'),
    reset: () => control.mutate('reset'),
    savedTranscript: speaker && phase === 'ended' && savedStart === String(started)
      ? visible.map((line) => `${line.time}  #${line.id}\n${line[language]}`).join('\n\n')
      : null,
  }
}
