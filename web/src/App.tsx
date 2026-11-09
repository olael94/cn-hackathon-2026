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
  Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Questions as QuestionsPanel } from '@/components/Questions'
import { useQuestions } from '@/api/questions'
import { demoRoom } from '@/api/demo'
import SpeakerConsole from '@/components/SpeakerConsole'
import { useDemoRoom } from '@/demoRoom'
import { useHealth } from '@/api/client'

import { LanguageContext, translator, useUiText, type Language } from '@/uiText'

type Room = ReturnType<typeof useDemoRoom>

const attendeeUrl = '/?room=' + encodeURIComponent(demoRoom)

function Brand() {
  const t = useUiText()
  return (
    <svg
      width="172"
      height="40"
      viewBox="0 0 172 40"
      fill="none"
      role="img"
      aria-label={t('RoomPass Live Captions')}
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
  const t = useUiText()
  return (
    <div className="room-ticket">
      <div className="ticket-stub" aria-hidden="true">
        <Captions size={22} />
        <span>ROOMPASS</span>
      </div>
      <div className="ticket-face">
        <div>
          <span className="meta">{t('ROOM')}</span>
          <strong>{demoRoom}</strong>
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

function Header({ room, speaker, language }: { room: Room; speaker: boolean; language: Language }) {
  const t = useUiText()
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
          <a href={attendeeUrl} className="brand">
            <Brand />
          </a>
          <div className="head-location">
            <span>{t('Room')} {demoRoom}</span>
            <ChevronRight size={13} />
            <b>{speaker ? t('Speaker') : t('Attendee')}</b>
          </div>
          <div className="head-status mono" role="status">
            <i />
            {room.badge ? t(room.badge) : t('{status} · {seconds}s behind', {
              status: t(level === 'delayed' ? 'LAG' : 'LIVE'),
              seconds: lag.toLocaleString(language, {minimumFractionDigits: 1, maximumFractionDigits: 1}),
            })}
          </div>
        </div>
      </header>
      <div className="notice">
        <div className="shell">
          <span>
            <CircleHelp size={14} /> {t('Machine captions · may contain errors')}
          </span>
          <span className="meta">{t('Target: p95 < 10s')}</span>
        </div>
      </div>
    </>
  )
}

function CaptionFeed({ room, language }: { room: Room; language: Language }) {
  const t = useUiText()
  const current = room.latest
  return (
    <section className="feed" aria-label={t('Caption stream')}>
      <div className="section-heading">
        <h2>
          <Captions />
          {t('Caption stream')}
        </h2>
        <span className="meta">{room.phase !== 'waiting' && (t(room.voiceId ? 'Speaker voice' : 'Sample replay') + ' · ')}{t(language === 'en' ? 'English' : 'Spanish')}</span>
      </div>
      <div role="log" aria-live="polite" aria-relevant="additions text">
        {current ? (
          <article className="latest">
            <div className="caption-meta">
              <span>
                <AudioLines size={17} />
                {t('Latest caption')}
              </span>
              <span>
                {current.time} <b>/</b> #
                {current.id.toString().padStart(3, '0')}
              </span>
            </div>
            {language === 'es' && 'translationMissing' in current && current.translationMissing === true && <small>{t('Spanish translation unavailable')}</small>}
            <p className="main-line" lang={language === 'es' && 'translationMissing' in current && current.translationMissing ? 'en' : language}>
              {current[language]}
            </p>
          </article>
        ) : (
          <div className="latest waiting">
            <Radio size={26} />
            <h3>{room.badge && t(room.badge)}</h3>
            <p>{t('Captions appear here when the speaker starts talking.')}</p>
          </div>
        )}
      </div>
      {room.visible.length > 1 && (
        <>
          <div className="section-heading history-heading">
            <h2>
              <History />
              {t('Earlier captions')}
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
                    {language === 'es' && 'translationMissing' in line && line.translationMissing === true && <small>{t('Spanish translation unavailable')}</small>}
                    <p className="history-primary" lang={language === 'es' && 'translationMissing' in line && line.translationMissing ? 'en' : language}>
                      {line[language]}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </>
      )}
    </section>
  )
}

function SignalMonitor({ room, language }: { room: Room; language: Language }) {
  const t = useUiText()
  const latest = room.badge ? undefined : room.latest
  return (
    <section className="signal-panel panel">
      <div className="panel-heading">
        <h2>
          <Activity />
          {t('Caption delay')}
        </h2>
        <span className="meta">{room.voiceId ? t('VOICE') : t('REPLAY')}</span>
      </div>
      <div className="signal-body">
        <div>
          <strong className="mono">
            {latest?.lag.toLocaleString(language, {minimumFractionDigits: 1, maximumFractionDigits: 1}) ?? '—'}
            <small> s</small>
          </strong>
          <p>{t('Last segment')}</p>
        </div>
        <svg
          viewBox="0 0 140 44"
          width="140"
          height="44"
          aria-label={t('Delay of recent captions')}
          role="img"
        >
          <path d="M0 13H140" stroke="var(--border)" strokeDasharray="3 4" />
          {room.visible.slice(-7).map((line, i, lines) => (
            <rect
              key={line.id}
              x={i * 19 + 3}
              y={43 - Math.min(43, line.lag * 3)}
              width="12"
              height={Math.min(43, line.lag * 3)}
              fill={
                i === lines.length - 1
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
  const [settings, setSettings] = useState(readSettings)
  const room = useDemoRoom(speaker, settings.language)
  const questions = useQuestions()
  const health = useHealth()
  const [mobileQuestions, setMobileQuestions] = useState(false)
  const { language, light, size } = settings
  const t = translator(language)
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.theme = light ? 'swiss-light' : 'swiss'
    try {
      localStorage.setItem('roompass.reader', JSON.stringify(settings))
    } catch {
      /* Preferences apply for this visit. */
    }
  }, [light, language, settings])
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
    <LanguageContext.Provider value={language}>
    <div
      className="room-app"
      style={
        { '--caption-size': [1.25, 1.5, 1.75][size] + 'rem' } as CSSProperties
      }
    >
      <Header room={room} speaker={speaker} language={language} />
      <main className="shell content">
        <div className="session-banner">
          <div>
            <div className="event-line">
              <span className="event-rule" />
              Cloud Native Hackathon
            </div>
            <h1>{speaker ? t('Speaker console') : t('Live captions')}</h1>
            <div className="session-info">
              <span>
                <MapPin />
                {t('Main stage')}
              </span>
              <span>
                <Mic />
                Miguel Elizalde
              </span>
              {speaker && (
                <a href={attendeeUrl} target="_blank" rel="noreferrer">
                  {t('Open attendee view')}
                </a>
              )}
            </div>
          </div>
          <RoomPass />
        </div>
        <div className={`workspace ${mobileQuestions ? 'show-questions' : ''}`}>
          <div className="main-column">
            {speaker && (
              <SpeakerConsole
                phase={room.phase}
                voiceId={room.voiceId}
                ready={room.ready}
                controlError={room.controlError}
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
                {t('Download saved transcript')}
              </a>
            )}
            <CaptionFeed room={room} language={language} />
          </div>
          <aside className="side-column">
            <div id="room-questions" tabIndex={-1}>
              <QuestionsPanel
                key={room.voiceId ?? 'replay'}
                model={questions}
                speaker={speaker}
                segments={room.visible}
                liveVoice={Boolean(room.voiceId)}
              />
            </div>
            <SignalMonitor room={room} language={language} />
          </aside>
        </div>
        <footer className="session-footer">
          <span>
            <Radio size={14} /> {room.phase === 'waiting' ? t('Waiting for speaker') : room.voiceId ? t('Live voice captions') : t('Sample caption replay')}
          </span>
          <span>
            {t('Room service')}{' '}
            {health.isPending
              ? t('connecting')
              : health.isError
                ? t('unavailable')
                : t(health.data.status)}
          </span>
        </footer>
      </main>
      <nav className="reader-dock" aria-label={t('Reading controls')}>
        <div className="shell dock-inner">
          <span className="dock-title">
            <Captions size={18} />
            {t('Reading controls')}
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
            aria-label={t('Primary language: {language}. Switch language', { language })}
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
            aria-label={t('Caption size {size} pixels. Change text size', {size: 20 + size * 4})}
            onClick={() => setSettings({ ...settings, size: (size + 1) % 3 })}
          >
            <Type />
            <span className="desktop-label">{t('Text size')}</span>
            <span className="mono">{20 + size * 4}</span>
          </Button>
          <Button
            variant="outline"
            className="control"
            aria-label={t('Daylight contrast')}
            aria-pressed={light}
            onClick={() => setSettings({ ...settings, light: !light })}
          >
            <Contrast />
            <span className="desktop-label">{t('Contrast')}</span>
          </Button>
          <Button className="primary-action" onClick={toggleQuestions}>
            {mobileQuestions ? <Captions /> : <MessageSquare />}
            {mobileQuestions ? t('Captions') : t('Q&A')}
            <span className="dock-count">{questions.questions.length}</span>
          </Button>
        </div>
      </nav>
    </div>
    </LanguageContext.Provider>
  )
}
