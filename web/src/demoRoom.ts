import { useEffect, useState } from 'react'
import { demoRoom } from '@/api/demo'
import { useReplay } from '@/api/replay'

export const captions = [
  {
    id: 40,
    time: '12:00',
    en: 'Every room should have captions that everyone can follow.',
    es: 'Todas las salas deberían tener subtítulos que todos puedan seguir.',
    lag: 1.2,
  },
  {
    id: 41,
    time: '12:04',
    en: 'When a phone reconnects, it picks up the captions it missed.',
    es: 'Cuando un teléfono se reconecta, recupera los subtítulos que se perdió.',
    lag: 1.6,
  },
  {
    id: 42,
    time: '12:09',
    en: 'We measure delay from the moment a speaker finishes a line to the moment it reaches your phone.',
    es: 'Medimos el retraso desde que el ponente termina una frase hasta que aparece en tu teléfono.',
    lag: 5.2,
  },
  {
    id: 43,
    time: '12:17',
    en: 'A slower translation changes that number, even when the audio arrives on time.',
    es: 'Una traducción más lenta cambia ese número, aunque el audio llegue a tiempo.',
    lag: 8.1,
  },
  {
    id: 44,
    time: '12:25',
    en: 'The threshold is ten seconds. This caption arrived outside that window.',
    es: 'El umbral es de diez segundos. Este subtítulo llegó fuera de ese margen.',
    lag: 12.4,
  },
  {
    id: 45,
    time: '12:33',
    en: 'Switching translators brings the delay back down. The earlier captions stay on screen.',
    es: 'Cambiar de traductor reduce el retraso. Los subtítulos anteriores siguen en pantalla.',
    lag: 1.3,
  },
  {
    id: 46,
    time: '12:41',
    en: 'You can ask a question in either language and vote on what the room asks next.',
    es: 'Puedes hacer una pregunta en cualquiera de los dos idiomas y votar qué se pregunta después.',
    lag: 1.5,
  },
]

const transcriptKey = 'roompass:demo:transcript:' + demoRoom

export function useDemoRoom(speaker: boolean, language: 'en' | 'es') {
  const { state, control } = useReplay()
  const [clockTick, setClockTick] = useState(0)
  const [savedStart, setSavedStart] = useState(() => {
    try { return localStorage.getItem(transcriptKey) } catch { return null }
  })
  const session = state.data
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
  const visible = captions.slice(0, count)
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
    : !count ? 'Waiting for first caption'
    : now >= (started ?? 0) + 2000 + captions.length * 8000 ? 'Sample complete'
    : null

  async function start(save: boolean) {
    const next = await control.mutateAsync('start')
    const value = save ? String(next.started_ms) : null
    setSavedStart(value)
    try {
      if (value) localStorage.setItem(transcriptKey, value)
      else localStorage.removeItem(transcriptKey)
    } catch { /* The download stays available during this visit. */ }
  }
  return {
    phase, visible, badge, latest: visible.at(-1), start,
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
