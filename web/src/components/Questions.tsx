import { useId, useRef, useState } from 'react'
import { ChevronUp, MessageSquare, Plus, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  newId,
  type Action,
  type Review,
  type useQuestions,
} from '@/api/questions'
import { captions } from '@/demoRoom'
import './questions.css'

type Segment = { id: number; time: string; en: string; es: string }
const samples = [
  'Si se corta mi conexión, ¿puedo recuperar los subtítulos?',
  '¿Cuánto historial recupero si vuelvo veinte minutos después?',
]

export function Questions({
  model,
  speaker,
  segments,
}: {
  model: ReturnType<typeof useQuestions>
  speaker: boolean
  segments: readonly Segment[]
}) {
  const heading = useId()
  const input = useId()
  const [open, setOpen] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [draft, setDraft] = useState('')
  const [lang, setLang] = useState<'es' | 'en'>('es')
  const [review, setReview] = useState<Review | null>(null)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const attempt = useRef({ signature: '', id: '' })
  const citation = segments.find((line) => line.id === review?.segment)
  const filtered = model.questions.filter((group) => !mineOnly || group.mine)

  function toggle(next: boolean) {
    if (busy) return
    setOpen(next)
    setReview(null)
    setDraft('')
    setError('')
    attempt.current.signature = ''
  }

  async function check() {
    setBusy(true)
    setError('')
    try {
      const result = await model.check(draft.trim())
      setReview(result)
      setTarget(result.target ?? '')
    } catch (cause) {
      console.error(cause)
      setError('Search is unavailable. You can still post your question.')
      setReview({
        target: null,
        segment: null,
        score: null,
        source: 'replay',
        suggestion: null,
      })
      setTarget('')
    } finally {
      setBusy(false)
    }
  }

  async function send(action: Action, parent?: string, text?: string) {
    setBusy(true)
    setError('')
    const payload = {
      action,
      target: parent,
      text,
      lang,
      segment: citation?.id,
    }
    const signature = JSON.stringify(payload)
    if (attempt.current.signature !== signature)
      attempt.current = { signature, id: newId() }
    try {
      await model.submit({ ...payload, request_id: attempt.current.id })
      setOpen(false)
      setDraft('')
      setReview(null)
      attempt.current.signature = ''
      setNotice(
        {
          ask: 'Question posted',
          support: 'Support recorded',
          expand: 'Follow-up added',
        }[action],
      )
    } catch (cause) {
      console.error(cause)
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="qa-panel" aria-labelledby={heading}>
      <header className="qa-heading">
        <MessageSquare size={19} aria-hidden="true" />
        <h2 id={heading}>Room Q&amp;A</h2>
        <span className="qa-count">{model.questions.length}</span>
      </header>
      <div className="qa-filters">
        <span>Most supported first</span>
        {!speaker && (
          <label className="qa-filter">
            <select
              aria-label="Filter questions"
              value={mineOnly ? 'mine' : 'all'}
              onChange={(e) => setMineOnly(e.target.value === 'mine')}
            >
              <option value="all">All questions</option>
              <option value="mine">My questions</option>
            </select>
          </label>
        )}
      </div>
      {model.loading && <p role="status">Loading the room’s questions…</p>}
      {model.failed && (
        <Alert>
          <AlertDescription>
            Shared queue unavailable. Reconnecting…
          </AlertDescription>
        </Alert>
      )}
      <ol className="qa-list">
        {filtered.map((group) => {
          const evidence = captions.find((line) => line.id === group.segment)
          return (
            <li key={group.id}>
              <div className="qa-copy">
                <p lang={speaker && group.translation ? 'en' : group.lang}>
                  {(speaker && group.translation) || group.text}
                </p>
                {speaker && group.translation && (
                  <small lang={group.lang}>{group.text}</small>
                )}
                {speaker && (
                  <details className="qa-brief">
                    <summary>Speaker brief</summary>
                    <strong>Asked by the room</strong>
                    <p lang={group.lang}>{group.text}</p>
                    <strong>Already discussed</strong>
                    {evidence ? (
                      <blockquote lang="en">
                        {evidence.en} <cite>· {evidence.time}</cite>
                      </blockquote>
                    ) : (
                      <p>No caption reference found.</p>
                    )}
                    <strong>What to clarify</strong>
                    <p>{group.expansions[0]?.text ?? 'No follow-up yet.'}</p>
                    {group.formulations.length > 0 && (
                      <details>
                        <summary>
                          Other wordings ({group.formulations.length})
                        </summary>
                        {group.formulations.map((text) => (
                          <p key={text}>{text}</p>
                        ))}
                      </details>
                    )}
                  </details>
                )}
                {group.expansions.map((detail) => (
                  <div className="qa-followup" key={detail.id}>
                    <small>
                      Follow-up · {detail.votes}{' '}
                      {detail.votes === 1 ? 'supporter' : 'supporters'}
                    </small>
                    <p lang={detail.lang}>{detail.text}</p>
                    {!speaker && (
                      <Button
                        variant="ghost"
                        disabled={busy || detail.voted}
                        onClick={() => void send('support', detail.id)}
                      >
                        {detail.voted ? 'Supported' : 'Support follow-up'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {speaker ? (
                <span
                  className="qa-vote"
                  aria-label={group.votes + ' supporters'}
                >
                  <ChevronUp size={15} />
                  {group.votes}
                </span>
              ) : (
                <button
                  className="qa-vote"
                  aria-label={'Support ' + group.text}
                  aria-pressed={group.voted}
                  disabled={busy || group.voted}
                  onClick={() => void send('support', group.id)}
                >
                  <ChevronUp size={15} />
                  {group.votes}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      {mineOnly && !filtered.length && (
        <p className="qa-empty">Your contributions will appear here.</p>
      )}
      <div className="qa-notice" role="status">
        {notice}
      </div>
      {error && !open && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!speaker && (
        <Dialog.Root open={open} onOpenChange={toggle}>
          <Dialog.Trigger asChild>
            <Button className="qa-ask">
              <Plus />
              Ask a question
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="qa-overlay" />
            <Dialog.Content className="qa-dialog">
              <div className="qa-dialog-heading">
                <Dialog.Title>Ask a question</Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className="qa-close"
                    disabled={busy}
                    aria-label="Close question"
                  >
                    <X />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="qa-description">
                Check what the speaker and the room have already covered.
              </Dialog.Description>
              {!review ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void check()
                  }}
                >
                  <div className="qa-language">
                    <label htmlFor={input}>Your question</label>
                    <select
                      aria-label="Question language"
                      disabled={busy}
                      value={lang}
                      onChange={(e) =>
                        setLang(e.target.value === 'en' ? 'en' : 'es')
                      }
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <textarea
                    id={input}
                    required
                    maxLength={500}
                    rows={3}
                    value={draft}
                    disabled={busy}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="qa-samples">
                    {samples.map((sample, i) => (
                      <button
                        type="button"
                        className="qa-example"
                        disabled={busy}
                        key={sample}
                        onClick={() => {
                          setDraft(sample)
                          setLang('es')
                        }}
                      >
                        {i ? 'Use sample follow-up' : 'Use sample question'}
                      </button>
                    ))}
                  </div>
                  <Button
                    className="qa-ask"
                    type="submit"
                    disabled={busy || !draft.trim()}
                  >
                    {busy ? 'Checking…' : 'Check captions'}
                  </Button>
                </form>
              ) : (
                <>
                  <p className="qa-draft" lang={lang}>
                    {draft}
                  </p>
                  {citation ? (
                    <div className="qa-citation">
                      <strong>Possibly covered at {citation.time}</strong>
                      <blockquote lang="en">{citation.en}</blockquote>
                      <small>
                        {review.score === null
                          ? 'Replay reference'
                          : 'Keyword match · ' + review.score.toFixed(2)}
                      </small>
                    </div>
                  ) : (
                    <p className="qa-description">
                      No matching caption available.
                    </p>
                  )}
                  <label className="qa-related">
                    Related room question
                    <select
                      value={target}
                      disabled={busy}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">Choose a question (optional)</option>
                      {model.questions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.text}
                        </option>
                      ))}
                    </select>
                  </label>
                  {target && target === review.target && review.suggestion && (
                    <p className="qa-description">
                      {
                        {
                          support: 'These questions may need the same answer.',
                          expand: 'This may add a new detail.',
                          ask: 'This may be clearer as a separate question.',
                        }[review.suggestion]
                      }
                    </p>
                  )}
                  <div className="qa-actions">
                    {target && (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void send('support', target, draft.trim())
                          }
                        >
                          I want to know too
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void send('expand', target, draft.trim())
                          }
                        >
                          Add as follow-up
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void send('ask', undefined, draft.trim())}
                    >
                      Post separately
                    </Button>
                    {citation && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => toggle(false)}
                      >
                        This answers it
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setReview(null)
                        setError('')
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}
              {error && (
                <Alert>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  )
}
