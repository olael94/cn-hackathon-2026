import { useEffect, useState, type CSSProperties } from 'react'
import {
  Activity,
  AudioLines,
  Captions,
  ChevronRight,
  CircleHelp,
  Contrast,
  History,
  Languages,
  MapPin,
  MessageSquare,
  Mic,
  Radio,
  RotateCcw,
  Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Questions as QuestionsPanel } from '@/components/Questions'
import { useQuestions } from '@/api/questions'
import SpeakerConsole from '@/components/SpeakerConsole'
import { useDemoRoom } from '@/demoRoom'
import { useHealth } from '@/api/client'

type Room = ReturnType<typeof useDemoRoom>
type Language = 'en' | 'es'

function Brand() {
  return (
    <svg
      width="172"
      height="40"
      viewBox="0 0 172 40"
      fill="none"
      role="img"
      aria-label="RoomPass Live Captions"
    >
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="4"
        fill="var(--card)"
        stroke="var(--border-strong)"
        strokeWidth="2"
      />
      <rect
        x="15"
        y="7"
        width="10"
        height="2.5"
        fill="var(--muted-foreground)"
      />
      <path
        d="M9 19H23"
        stroke="var(--foreground)"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <path
        d="M9 26H17"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <circle cx="27" cy="26" r="3" fill="var(--status-color)" />
      <text
        x="46"
        y="27"
        fill="var(--foreground)"
        fontFamily="var(--font-sans)"
        fontWeight="700"
        fontSize="21"
        letterSpacing="-0.03em"
      >
        Room<tspan fill="var(--primary)">Pass</tspan>
      </text>
    </svg>
  )
}

function RoomPass() {
  return (
    <div className="room-ticket" aria-label="Room 01, Main stage">
      <div className="ticket-stub" aria-hidden="true">
        <Captions size={22} />
        <span>ROOMPASS</span>
      </div>
      <div className="ticket-face">
        <div>
          <span className="meta">ROOM</span>
          <strong>01</strong>
        </div>
        <div className="ticket-bars" aria-hidden="true">
          {[2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 3].map(
            (width, index) => (
              <i key={index} style={{ width }} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function Header({ room, speaker }: { room: Room; speaker: boolean }) {
  const lag = room.latest?.lag ?? 0
  const level = room.badge
    ? 'idle'
    : lag > 10
      ? 'delayed'
      : lag > 6
        ? 'warning'
        : 'healthy'
  return (
    <>
      <header className={`masthead signal-${level}`}>
        <div className="shell head-inner">
          <a href="/" className="brand">
            <Brand />
          </a>
          <div className="head-location">
            <span>Demo room</span>
            <ChevronRight size={13} />
            <b>{speaker ? 'Speaker' : 'Attendee'}</b>
          </div>
          <div className="head-status mono" role="status">
            <i />
            {room.badge ??
              `${level === 'delayed' ? 'LAG' : 'LIVE'} · ${lag.toFixed(1)}s behind`}
          </div>
        </div>
      </header>
      <div className="notice">
        <div className="shell">
          <span>
            <CircleHelp size={14} /> Machine captions · may contain errors
          </span>
          <span className="meta">Target: p95 &lt; 10s</span>
        </div>
      </div>
    </>
  )
}

function CaptionFeed({ room, language }: { room: Room; language: Language }) {
  const other = language === 'en' ? 'es' : 'en'
  const current = room.latest
  return (
    <section className="feed" aria-label="Caption stream">
      <div className="section-heading">
        <h2>
          <Captions />
          Caption stream
        </h2>
        <span className="meta">Sample replay · EN / ES</span>
      </div>
      <div role="log" aria-live="polite" aria-relevant="additions text">
        {current ? (
          <article className="latest">
            <div className="caption-meta">
              <span>
                <AudioLines size={17} />
                Latest caption
              </span>
              <span>
                {current.time} <b>/</b> #
                {current.id.toString().padStart(3, '0')}
              </span>
            </div>
            <p className="main-line" lang={language}>
              {current[language]}
            </p>
            <div className="translation">
              <span className="language-mark">{other.toUpperCase()}</span>
              <p lang={other}>{current[other]}</p>
            </div>
          </article>
        ) : (
          <div className="latest waiting">
            <Radio size={26} />
            <h3>{room.badge}</h3>
            <p>Captions appear here when the speaker starts talking.</p>
          </div>
        )}
      </div>
      {room.visible.length > 1 && (
        <>
          <div className="section-heading history-heading">
            <h2>
              <History />
              Earlier captions
            </h2>
          </div>
          <ol className="history">
            {room.visible
              .slice(0, -1)
              .reverse()
              .map((line) => (
                <li key={line.id}>
                  <div className="stamp">
                    <span>{line.time}</span>
                    <small>#{line.id.toString().padStart(3, '0')}</small>
                  </div>
                  <div>
                    <p className="history-primary" lang={language}>
                      {line[language]}
                    </p>
                    <p className="history-secondary" lang={other}>
                      {line[other]}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </>
      )}
      {room.ended && room.preview && (
        <Button className="control" variant="outline" onClick={room.replay}>
          <RotateCcw />
          Replay sample
        </Button>
      )}
    </section>
  )
}

function SignalMonitor({ room }: { room: Room }) {
  const latest = room.badge ? undefined : room.latest
  return (
    <section className="signal-panel panel">
      <div className="panel-heading">
        <h2>
          <Activity />
          Caption delay
        </h2>
        <span className="meta">REPLAY</span>
      </div>
      <div className="signal-body">
        <div>
          <strong className="mono">
            {latest?.lag.toFixed(1) ?? '—'}
            <small> s</small>
          </strong>
          <p>Last segment</p>
        </div>
        <svg
          viewBox="0 0 140 44"
          width="140"
          height="44"
          aria-label="Delay of recent sample captions"
          role="img"
        >
          <path d="M0 13H140" stroke="var(--border)" strokeDasharray="3 4" />
          {room.visible.map((line, i) => (
            <rect
              key={line.id}
              x={i * 19 + 3}
              y={43 - line.lag * 3}
              width="12"
              height={line.lag * 3}
              fill={
                i === room.visible.length - 1
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)'
              }
            />
          ))}
        </svg>
      </div>
    </section>
  )
}

function readSettings() {
  const defaultSize = window.matchMedia('(min-width: 801px)').matches ? 2 : 0
  try {
    const value = JSON.parse(localStorage.getItem('roompass.reader') ?? '{}')
    return {
      language: (value.language === 'es' ? 'es' : 'en') as Language,
      light: value.light === true,
      size: [0, 1, 2].includes(value.size) ? Number(value.size) : defaultSize,
    }
  } catch {
    return { language: 'en' as Language, light: false, size: defaultSize }
  }
}

export default function App() {
  const speaker = location.pathname.replace(/\/$/, '') === '/speaker'
  const room = useDemoRoom(speaker)
  const questions = useQuestions()
  const health = useHealth()
  const [settings, setSettings] = useState(readSettings)
  const [mobileQuestions, setMobileQuestions] = useState(false)
  const { language, light, size } = settings
  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'swiss-light' : 'swiss'
    try {
      localStorage.setItem('roompass.reader', JSON.stringify(settings))
    } catch {
      /* Preferences apply for this visit. */
    }
  }, [light, settings])
  function toggleQuestions() {
    const mobile = window.matchMedia('(max-width: 800px)').matches
    if (mobile) {
      setMobileQuestions(!mobileQuestions)
      window.scrollTo(0, 0)
    } else {
      const area = document.getElementById('room-questions')
      area?.scrollIntoView({ block: 'center' })
      area?.focus({ preventScroll: true })
    }
  }
  return (
    <div
      className="room-app"
      style={
        { '--caption-size': [1.25, 1.5, 1.75][size] + 'rem' } as CSSProperties
      }
    >
      <Header room={room} speaker={speaker} />
      <main className="shell content">
        <div className="session-banner">
          <div>
            <div className="event-line">
              <span className="event-rule" />
              Cloud Native Hackathon
            </div>
            <h1>{speaker ? 'Speaker console' : 'Live captions'}</h1>
            <div className="session-info">
              <span>
                <MapPin />
                Main stage
              </span>
              <span>
                <Mic />
                Miguel Elizalde
              </span>
            </div>
          </div>
          <RoomPass />
        </div>
        <div className={`workspace ${mobileQuestions ? 'show-questions' : ''}`}>
          <div className="main-column">
            {speaker && (
              <SpeakerConsole
                phase={room.phase}
                onStart={room.start}
                onStop={room.stop}
                onReset={room.reset}
              />
            )}
            {speaker && room.savedTranscript && (
              <a
                className="control transcript-download"
                download="roompass-transcript.txt"
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(room.savedTranscript)}`}
              >
                Download saved transcript
              </a>
            )}
            <CaptionFeed room={room} language={language} />
          </div>
          <aside className="side-column">
            <div id="room-questions" tabIndex={-1}>
              <QuestionsPanel
                model={questions}
                speaker={speaker}
                segments={room.visible}
              />
            </div>
            <SignalMonitor room={room} />
          </aside>
        </div>
        <footer className="session-footer">
          <span>
            <Radio size={14} /> Demo replay · sample captions
          </span>
          <span>
            Room service{' '}
            {health.isPending
              ? 'connecting'
              : health.isError
                ? 'unavailable'
                : health.data.status}
          </span>
        </footer>
      </main>
      <nav className="reader-dock" aria-label="Reading controls">
        <div className="shell dock-inner">
          <span className="dock-title">
            <Captions size={18} />
            Reading controls
          </span>
          <Button
            variant="outline"
            className="control"
            onClick={() =>
              setSettings({
                ...settings,
                language: language === 'en' ? 'es' : 'en',
              })
            }
            aria-label={`Primary language: ${language}. Switch language`}
          >
            <Languages />
            <span>
              {language.toUpperCase()}{' '}
              <span className="muted">/ {language === 'en' ? 'ES' : 'EN'}</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="control"
            aria-label={`Caption size ${20 + size * 4} pixels. Change text size`}
            onClick={() => setSettings({ ...settings, size: (size + 1) % 3 })}
          >
            <Type />
            <span className="desktop-label">Text size</span>
            <span className="mono">{20 + size * 4}</span>
          </Button>
          <Button
            variant="outline"
            className="control"
            aria-label="Daylight contrast"
            aria-pressed={light}
            onClick={() => setSettings({ ...settings, light: !light })}
          >
            <Contrast />
            <span className="desktop-label">Contrast</span>
          </Button>
          <Button className="primary-action" onClick={toggleQuestions}>
            {mobileQuestions ? <Captions /> : <MessageSquare />}
            {mobileQuestions ? 'Captions' : 'Q&A'}
            <span className="dock-count">{questions.questions.length}</span>
          </Button>
        </div>
      </nav>
    </div>
  )
}
