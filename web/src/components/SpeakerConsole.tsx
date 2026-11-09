import { AudioLines, Mic, MicOff, Radio, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { recordVoice, voiceFormat } from '@/api/voice'

type SpeakerProps = {
  phase: 'waiting' | 'live' | 'draining' | 'ended'
  ready: boolean
  controlError: string | null
  voiceId?: string | null
  onStart: (save: boolean, voice: boolean) => Promise<string | null>
  onStop: () => void
  onReset: () => void
}

function HoldToStop({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const input = useRef<string | number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [elapsed, setElapsed] = useState(0)
  const cancel = useCallback(() => {
    window.clearInterval(timer.current)
    input.current = null
    setElapsed(0)
  }, [])

  useEffect(() => {
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', cancel)
    return () => {
      window.clearInterval(timer.current)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', cancel)
    }
  }, [cancel])

  function begin(source: string | number) {
    if (input.current !== null) return
    input.current = source
    const start = performance.now()
    timer.current = window.setInterval(() => {
      const duration = Math.min(3000, performance.now() - start)
      setElapsed(duration)
      if (duration >= 3000) {
        window.clearInterval(timer.current)
        onConfirm()
      }
    }, 40)
  }

  function release(source: string | number) {
    if (input.current === source) cancel()
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-label="Hold to end talk"
        disabled={disabled}
        aria-describedby="hold-help"
        className="relative flex min-h-14 touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-destructive bg-background px-4 font-mono text-sm font-bold text-foreground tabular-nums"
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          begin(event.pointerId)
        }}
        onPointerUp={(event) => release(event.pointerId)}
        onPointerCancel={(event) => release(event.pointerId)}
        onLostPointerCapture={(event) => release(event.pointerId)}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return
          event.preventDefault()
          if (!event.repeat) begin(event.key)
        }}
        onKeyUp={(event) => release(event.key)}
        onBlur={cancel}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 origin-left bg-danger-tint"
          style={{ transform: `scaleX(${elapsed / 3000})` }}
        />
        <Square aria-hidden="true" size={16} className="relative" />
        <span className="relative">
          {elapsed
            ? `Ending in ${((3000 - elapsed) / 1000).toFixed(1)} s`
            : 'Hold 3.0 s to end talk'}
        </span>
      </button>
      <p id="hold-help" className="text-sm text-muted-foreground">
        Hold with touch, Space or Enter. Release early to cancel.
      </p>
    </div>
  )
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function captureError(error: unknown, tabAudio: boolean) {
  if (tabAudio) return 'Select the video tab in desktop Chrome and turn on Share tab audio, then try again.'
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Allow microphone access in your browser’s site settings, then try again.'
  }
  return 'Check that a microphone is connected and available, then try again.'
}

export default function SpeakerConsole({
  phase,
  ready,
  voiceId,
  controlError,
  onStart,
  onStop,
  onReset,
}: SpeakerProps) {
  const [save, setSave] = useState(false)
  const [source, setSource] = useState<'voice' | 'tab' | 'sample'>('voice')
  const tabAudio = source === 'tab' && (phase === 'waiting' || Boolean(voiceId))
  const voice = source !== 'sample'
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sourceActive, setSourceActive] = useState(false)
  const [previousPhase, setPreviousPhase] = useState(phase)
  const stream = useRef<MediaStream | null>(null)
  const stopRecorder = useRef<(() => Promise<void>) | null>(null)
  const request = useRef(0)
  const phaseRef = useRef(phase)
  const releaseSource = useCallback(() => {
    request.current += 1
    void stopRecorder.current?.()
    stopRecorder.current = null
    stopTracks(stream.current)
    stream.current = null
  }, [])

  if (previousPhase !== phase) {
    setPreviousPhase(phase)
    setError('')
    if (phase !== 'live') {
      setSourceActive(false)
      setPending(false)
    }
    if (phase === 'waiting') setSave(false)
  }

  useEffect(() => {
    phaseRef.current = phase
    if (phase !== 'live') releaseSource()
  }, [phase, releaseSource])

  useEffect(() => {
    function onPageHide() {
      releaseSource()
      setSourceActive(false)
      setPending(false)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      releaseSource()
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [releaseSource])

  async function connectSource() {
    if (pending) return
    const attempt = ++request.current
    setPending(true)
    setError('')
    try {
      if ((phase === 'waiting' ? voice : voiceId) && !voiceFormat()) {
        setError('This browser cannot record voice. Use Safari or Chrome.')
        return
      }
      if (!navigator.mediaDevices) {
        setError(
          'Open the speaker link over HTTPS or on localhost to share audio.',
        )
        return
      }
      if (tabAudio && !navigator.mediaDevices.getDisplayMedia) {
        setError('Open the speaker console and the video in desktop Chrome to share tab audio.')
        return
      }
      const media = tabAudio
        ? await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: true })
        : await navigator.mediaDevices.getUserMedia({ audio: true })
      if (request.current !== attempt || phaseRef.current !== phase) {
        stopTracks(media)
        return
      }
      const track = media
        .getAudioTracks()
        .find((item) => item.readyState === 'live')
      if (!track) {
        stopTracks(media)
        setError(tabAudio ? 'Choose a Chrome Tab and enable Share tab audio.' : 'Your microphone disconnected. Connect it and try again.')
        return
      }
      const screen = media.getVideoTracks()[0]
      if (tabAudio && screen?.getSettings().displaySurface && screen.getSettings().displaySurface !== 'browser') {
        stopTracks(media)
        setError('Select the tab playing the video in the Chrome Tab list.')
        return
      }
      stream.current = media
      // The picker supplies a video track as well. Send only the selected audio track to the recorder.
      if (screen) screen.enabled = false
      const disconnected = () => {
        if (stream.current !== media) return
        releaseSource()
        setSourceActive(false)
        setPending(false)
        setError(tabAudio ? 'Tab sharing stopped. Share the video tab again to continue.' : 'Your microphone disconnected. Reconnect it to continue.')
      }
      screen?.addEventListener('ended', disconnected, { once: true })
      track.addEventListener('ended', disconnected, { once: true })
      const id = phase === 'waiting' ? await onStart(save, voice) : voiceId
      if (request.current !== attempt) return
      if (id) {
        const stop = await recordVoice(new MediaStream([track]), id, message => {
          releaseSource()
          setSourceActive(false)
          setPending(false)
          setError(message)
        })
        if (request.current !== attempt) { void stop(); return }
        stopRecorder.current = stop
      }
      setSourceActive(true)
    } catch (failure) {
      if (request.current === attempt) {
        console.error('Audio capture failed', failure)
        releaseSource()
        setPending(false)
        setError(failure instanceof Error && !(failure instanceof DOMException) ? failure.message : captureError(failure, tabAudio))
      }
    } finally {
      if (request.current === attempt) setPending(false)
    }
  }

  async function finishTalk() {
    setPending(true)
    const uploads = stopRecorder.current?.()
    releaseSource()
    setSourceActive(false)
    try {
      await uploads
      onStop()
    } finally {
      setPending(false)
    }
  }

  const canConnect = phase === 'waiting' || (phase === 'live' && !sourceActive)
  const startLabel = error
    ? (tabAudio ? 'Share tab again' : 'Try microphone again')
    : phase === 'live'
      ? (tabAudio ? 'Share video tab' : 'Connect microphone')
      : 'Start talk'

  return (
    <section className="panel" aria-label="Speaker controls">
      <div className="panel-heading">
        <Radio aria-hidden="true" size={20} />
        <h2>Broadcast controls</h2>
      </div>
      <div className="grid gap-5 p-5 sm:p-6">
        <div role="status" className="flex items-center gap-3 font-bold">
          {sourceActive ? (
            <AudioLines aria-hidden="true" />
          ) : (
            <MicOff aria-hidden="true" />
          )}
          {phase === 'waiting' && 'Ready to start'}
          {phase === 'live' &&
            (sourceActive ? (tabAudio ? 'Capturing tab audio' : voiceId ? 'Capturing your voice' : 'Microphone active') : 'Audio source disconnected')}
          {phase === 'draining' && 'Finishing captions (5 s)'}
          {phase === 'ended' && 'Talk ended'}
        </div>
        {(phase === 'waiting' || phase === 'live') && (
          <p className="text-sm text-muted-foreground">
            {tabAudio ? 'Select the video tab and enable Share tab audio. Play the video once capture starts.'
              : (phase === 'waiting' ? voice : voiceId)
              ? 'Speak in English. Your voice is sent for transcription and Spanish translation.'
              : 'Replay the sample captions for this room.'}
          </p>
        )}
        {(phase === 'waiting' || (voiceId && !sourceActive && phase === 'live')) && (
          <label>Caption source{' '}
            <select className="control" disabled={pending} value={source}
              onChange={e => {
                const selected = e.target.value
                setSource(selected === 'tab' || selected === 'sample' ? selected : 'voice')
                setError('')
              }}>
              <option value="voice">Live microphone</option>
              <option value="tab">Browser tab audio</option>
              {phase === 'waiting' && <option value="sample">Sample replay</option>}
            </select>
          </label>
        )}
        {phase === 'waiting' && (
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 border-y border-border py-3">
            Save the transcript on this device
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={save}
              disabled={pending}
              onChange={(event) => setSave(event.target.checked)}
            />
          </label>
        )}
        {(error || controlError) && (
          <Alert>
            <AlertDescription>{error || controlError}</AlertDescription>
          </Alert>
        )}
        {canConnect && (
          <Button
            className="primary-action min-h-12"
            disabled={pending || !ready}
            onClick={connectSource}
          >
            <Mic aria-hidden="true" />
            {pending ? (tabAudio ? 'Connecting tab audio…' : 'Waiting for microphone…') : startLabel}
          </Button>
        )}
        {phase === 'live' && <HoldToStop onConfirm={() => void finishTalk()} disabled={!ready || pending} />}
        {phase === 'ended' && (
          <Button
            variant="outline"
            className="control min-h-12"
            onClick={onReset}
            disabled={!ready}
          >
            Prepare another talk
          </Button>
        )}
      </div>
    </section>
  )
}
