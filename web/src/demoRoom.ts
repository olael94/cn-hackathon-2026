import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

// Local replay for the two UI clients until the room streaming service ships.
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

const sessionSchema = z.object({
  phase: z.enum(['waiting', 'live', 'draining', 'ended']),
  started: z.number(),
  stopped: z.number(),
  save: z.boolean(),
})
type Session = z.infer<typeof sessionSchema>
const roomKey = 'roompass.demo.session.v1'
function readSession(): Session | null {
  try {
    const result = sessionSchema.safeParse(
      JSON.parse(localStorage.getItem(roomKey) ?? 'null'),
    )
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function useDemoRoom(speaker: boolean) {
  const localOnly = useRef(false)
  const [session, setSession] = useState(readSession)
  const [previewStart, setPreviewStart] = useState(Date.now)
  const [now, setNow] = useState(Date.now)
  const [online, setOnline] = useState(navigator.onLine)
  const [disconnectedAt, setDisconnectedAt] = useState(Date.now)
  const [resumedAt, setResumedAt] = useState(0)
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 500)
    const sync = (event: StorageEvent) => {
      if (!localOnly.current && event.key === roomKey) setSession(readSession())
    }
    const offline = () => {
      setDisconnectedAt(Date.now())
      setOnline(false)
    }
    const resume = () => {
      setResumedAt(Date.now())
      setOnline(true)
    }
    window.addEventListener('storage', sync)
    window.addEventListener('offline', offline)
    window.addEventListener('online', resume)
    return () => {
      clearInterval(tick)
      window.removeEventListener('storage', sync)
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', resume)
    }
  }, [])

  function update(next: Session) {
    try {
      localStorage.setItem(roomKey, JSON.stringify(next))
      localOnly.current = false
    } catch {
      // Storage can be readable but reject writes. This tab owns the session until a write succeeds.
      localOnly.current = true
    }
    setSession(next)
    setNow(Date.now())
  }

  const preview = !speaker && !session
  const start = session?.started ?? previewStart
  const receivedUntil = online ? now : disconnectedAt
  const elapsed = Math.max(0, receivedUntil - start)
  const phase =
    session?.phase === 'draining' && now >= session.stopped + 5000
      ? 'ended'
      : (session?.phase ?? (preview ? 'live' : 'waiting'))
  const until = session?.stopped
    ? Math.min(receivedUntil, session.stopped + 5000)
    : receivedUntil
  const count =
    phase === 'waiting'
      ? 0
      : preview
        ? 3 + Math.floor(elapsed / 8000)
        : Math.max(0, 1 + Math.floor((until - start - 2000) / 8000))
  const visible = captions.slice(0, count)
  const lastArrival = preview
    ? start + (visible.length - 3) * 8000
    : start + 2000 + (visible.length - 1) * 8000
  const ended = phase === 'ended' || (preview && count > captions.length)
  const awaitingFreshSegment = resumedAt > start && lastArrival < resumedAt
  const sampleComplete =
    count > captions.length ||
    (visible.length === captions.length && awaitingFreshSegment)
  const latest = visible.at(-1)
  const badge = !online
    ? 'Reconnecting'
    : ended
      ? 'Talk ended'
      : phase === 'waiting'
        ? 'Waiting for speaker'
        : sampleComplete
          ? 'Sample complete'
          : awaitingFreshSegment
            ? 'Reconnecting'
            : !latest
              ? 'Waiting for first caption'
              : null
  return {
    phase,
    visible,
    badge,
    latest,
    ended,
    preview,
    savedTranscript:
      phase === 'ended' && session?.save
        ? visible
            .map(
              (line) =>
                `${line.time}  #${line.id}\nEN  ${line.en}\nES  ${line.es}`,
            )
            .join('\n\n')
        : null,
    start: (save: boolean) =>
      update({ phase: 'live', started: Date.now(), stopped: 0, save }),
    stop: () => {
      const active = localOnly.current ? session : (readSession() ?? session)
      if (active?.phase === 'live')
        update({ ...active, phase: 'draining', stopped: Date.now() })
    },
    reset: () =>
      update({ phase: 'waiting', started: 0, stopped: 0, save: false }),
    replay: () => {
      setPreviewStart(Date.now())
      setResumedAt(0)
    },
  }
}
