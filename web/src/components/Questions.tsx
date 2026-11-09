import { useContext, useId, useRef, useState } from 'react'
import { ChevronUp, MessageSquare, Plus, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  type Action,
  type Review,
  type useQuestions,
} from '@/api/questions'
import { captions } from '@/demoRoom'
import { newId } from '@/api/demo'
import { LanguageContext, useUiText } from '@/uiText'
import './questions.css'

type Segment = { id: number; time: string; en: string; es: string }
const samples = [
  'Can I recover missed captions when I reconnect?',
  'If I reconnect after twenty minutes, how much caption history can I recover?',
]

export function Questions({
  model,
  speaker,
  segments,
  liveVoice,
}: {
  model: ReturnType<typeof useQuestions>
  speaker: boolean
  segments: readonly Segment[]
  liveVoice: boolean
}) {
  const t = useUiText()
  const language = useContext(LanguageContext)
  const heading = useId()
  const input = useId()
  const [open, setOpen] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [draft, setDraft] = useState('')
  const [receipt, setReceipt] = useState<{message: string; question?: string} | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const attempt = useRef({ signature: '', id: '' })
  const citation = segments.find((line) => line.id === review?.segment)
  const reviewingCaption = Boolean(citation || (liveVoice && review?.segment != null))
  const filtered = model.questions.filter((group) => !mineOnly || group.mine)

  function toggle(next: boolean) {
    if (busy) return
    setOpen(next)
    setReview(null)
    setReceipt(null)
    setDraft('')
    setError('')
    attempt.current.signature = ''
  }

  async function submitDraft() {
    setBusy(true)
    setError('')
    try {
      const route = review ?? (await model.check(draft.trim()))
      setReview(route)
      const cited = segments.find((line) => line.id === route.segment)
      if (!review && (cited || (liveVoice && route.segment != null))) return
      await publish(route)
    } catch (cause) {
      console.error(cause)
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function publish(route: Review) {
    const action = route.target ? (route.suggestion ?? 'ask') : 'ask'
    await send(
      action,
      action === 'ask' ? undefined : (route.target ?? undefined),
      draft.trim(),
      liveVoice || segments.some(line => line.id === route.segment) ? route.segment ?? undefined : undefined,
    )
  }

  async function send(
    action: Action,
    parent?: string,
    text?: string,
    segment?: number,
  ) {
    setBusy(true)
    setError('')
    const payload = {
      action,
      target: parent,
      text,
      segment,
    }
    const signature = text
      ? text
      : JSON.stringify(payload)
    if (attempt.current.signature !== signature)
      attempt.current = { signature, id: newId() }
    const related = model.questions.find(
      (group) =>
        group.id === parent ||
        group.expansions.some((detail) => detail.id === parent),
    )
    try {
      const recorded = await model.submit({ ...payload, request_id: attempt.current.id })
      const message = {
        ask: 'Your question was added to the speaker’s queue.',
        support: text ? 'Your question counted as support for an existing question.' : 'Support recorded.',
        expand: related ? 'Your follow-up was added to “{question}”.' : 'Your follow-up was added.',
      }[recorded]
      if (text) setReceipt({message, question: related?.text})
      else setNotice(message)
      attempt.current.signature = ''
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
        <h2 id={heading}>{t('Room Q&A')}</h2>
        <span className="qa-count">{model.questions.length}</span>
      </header>
      <div className="qa-filters">
        <span>{t('Most supported first')}</span>
        {!speaker && (
          <label className="qa-filter">
            <select
              aria-label={t('Filter questions')}
              value={mineOnly ? 'mine' : 'all'}
              onChange={(e) => setMineOnly(e.target.value === 'mine')}
            >
              <option value="all">{t('All questions')}</option>
              <option value="mine">{t('My questions')}</option>
            </select>
          </label>
        )}
      </div>
      {model.loading && <p role="status">{t('Loading the room’s questions…')}</p>}
      {model.failed && (
        <Alert>
          <AlertDescription>
            {t('Shared queue unavailable. Reconnecting…')}
          </AlertDescription>
        </Alert>
      )}
      <ol className="qa-list">
        {filtered.map((group) => {
          const evidence = (liveVoice ? segments : captions).find((line) => line.id === group.segment)
          return (
            <li key={group.id}>
              <div className="qa-copy">
                <p lang={speaker && group.translation ? 'en' : group.lang}>
                  {(speaker && group.translation) || group.text}
                </p>
                {speaker && (
                  <details className="qa-brief">
                    <summary>{t('Speaker brief')}</summary>
                    <strong>{t('Asked by the room')}</strong>
                    <p lang={group.translation ? 'en' : group.lang}>{group.translation || group.text}</p>
                    <strong>{t('Already discussed')}</strong>
                    {evidence ? (
                      <blockquote lang="en">
                        {evidence.en} <cite>· {evidence.time}</cite>
                      </blockquote>
                    ) : (
                      <p>{t('No caption reference found.')}</p>
                    )}
                    <strong>{t('What to clarify')}</strong>
                    <p lang={group.expansions.length ? 'en' : language}>{group.expansions[0]?.translation ?? group.expansions[0]?.text ?? t('No follow-up yet.')}</p>
                    {group.formulations.length > 0 && (
                      <details>
                        <summary>
                          {t('Other wordings')} ({group.formulations.length})
                        </summary>
                        {group.formulations_en.map((text, i) => (
                          <p lang="en" key={group.formulations[i]}>{text}</p>
                        ))}
                      </details>
                    )}
                  </details>
                )}
                {group.expansions.map((detail) => (
                  <div className="qa-followup" key={detail.id}>
                    <small>
                      {t('Follow-up')} · {detail.votes}{' '}
                      {detail.votes === 1 ? t('supporter') : t('supporters')}
                    </small>
                    <p lang={speaker && detail.translation ? 'en' : detail.lang}>
                      {(speaker && detail.translation) || detail.text}
                    </p>
                    {!speaker && (
                      <Button
                        variant="ghost"
                        disabled={busy || detail.voted}
                        onClick={() => void send('support', detail.id)}
                      >
                        {detail.voted ? t('Supported') : t('Support follow-up')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {speaker ? (
                <span
                  className="qa-vote"
                  aria-label={group.votes + ' ' + t(group.votes === 1 ? 'supporter' : 'supporters')}
                >
                  <ChevronUp size={15} />
                  {group.votes}
                </span>
              ) : (
                <button
                  className="qa-vote"
                  aria-label={t('Support {question}', {question: group.text})}
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
        <p className="qa-empty">{t('Your contributions will appear here.')}</p>
      )}
      <div className="qa-notice" role="status">
        {t(notice)}
      </div>
      {error && !open && (
        <Alert>
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      )}
      {!speaker && (
        <Dialog.Root open={open} onOpenChange={toggle}>
          <Dialog.Trigger asChild>
            <Button className="qa-ask">
              <Plus />
              {t('Ask a question')}
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="qa-overlay" />
            <Dialog.Content className="qa-dialog">
              <div className="qa-dialog-heading">
                <Dialog.Title>
                  {receipt ? t('Question received') : reviewingCaption ? t('Review matching caption') : t('Ask a question')}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    className="qa-close"
                    disabled={busy}
                    aria-label={t('Close question')}
                  >
                    <X />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="qa-description" role={receipt ? 'status' : undefined}>
                {receipt ? t(receipt.message, {question: receipt.question ?? ''}) : (reviewingCaption
                  ? t('Read the caption below. Choose Still ask to send your question to the speaker.')
                  : t('Ask in English or Spanish. If a caption covers your question, you’ll see it first.'))}
              </Dialog.Description>
              {receipt ? (
                <>
                  <blockquote className="qa-draft">{draft.trim()}</blockquote>
                  <Dialog.Close asChild><Button className="qa-ask" autoFocus>{t('Done')}</Button></Dialog.Close>
                </>
              ) : !review || !reviewingCaption ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitDraft()
                  }}
                >
                  <div className="qa-language">
                    <label htmlFor={input}>{t('Your question')}</label>
                  </div>
                  <textarea
                    id={input}
                    required
                    maxLength={500}
                    rows={3}
                    value={draft}
                    disabled={busy}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setReview(null)
                    }}
                  />
                  <details>
                    <summary className="qa-example">{t('Question options')}</summary>
                    <div className="qa-samples">
                      {samples.map((sample, i) => (
                        <button
                          type="button"
                          className="qa-example"
                          disabled={busy}
                          key={sample}
                          onClick={() => {
                            setReview(null)
                            setDraft(t(sample))
                          }}
                        >
                          {i ? t('Use sample follow-up') : t('Use sample question')}
                        </button>
                      ))}
                    </div>
                  </details>
                  <Button
                    className="qa-ask"
                    type="submit"
                    disabled={busy || !draft.trim()}
                  >
                    {busy ? t('Sending…') : t('Send question')}
                  </Button>
                </form>
              ) : (
                <>
                  <p className="qa-draft">
                    {draft}
                  </p>
                  {citation ? (
                    <div className="qa-citation">
                      <strong>{t('Possibly covered at {time}', {time: citation.time})}</strong>
                      <blockquote lang={language}>{citation[language]}</blockquote>
                      {review.score != null && (
                        <small>{t('Semantic match score')} · {review.score.toLocaleString(language, { maximumFractionDigits: 3 })}</small>
                      )}
                    </div>
                  ) : <p role="status">{t('Waiting for the matching caption…')}</p>}
                  <div className="qa-actions">
                    <Button
                      disabled={busy || !citation}
                      onClick={() => {
                        toggle(false)
                        setNotice('Question resolved by the caption.')
                      }}
                    >
                      {t('This answers it')}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void submitDraft()}
                    >
                      {busy ? t('Sending…') : t('Still ask')}
                    </Button>
                  </div>
                </>
              )}
              {error && (
                <Alert>
                  <AlertDescription>{t(error)}</AlertDescription>
                </Alert>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  )
}
