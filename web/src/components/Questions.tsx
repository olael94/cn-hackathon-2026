import { useEffect, useId, useRef, useState } from 'react'
import {
  Check,
  ChevronUp,
  ListFilter,
  MessageSquare,
  Plus,
  X,
} from 'lucide-react'
import { Dialog } from 'radix-ui'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import './questions.css'

type Language = 'en' | 'es'
type Segment = { id: number; time: string; en: string; es: string }
const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  lang: z.enum(['en', 'es']),
  translation: z.string().optional(),
  created: z.number(),
})
type Question = z.infer<typeof questionSchema>
const roomKey = 'roompass:demo:qa:v1:'
const questionKey = roomKey + 'question:'
const voteKey = roomKey + 'vote:'
const sampleText = '¿Cómo recuperan los mensajes si se corta la conexión?'
const sampleEnglish = 'How do you recover messages if the connection drops?'
const sampleQuestions: (Question & { votes: number })[] = [
  {
    id: 'recovery',
    text: 'How do captions catch up after a reconnect?',
    lang: 'en',
    created: 0,
    votes: 8,
  },
  {
    id: 'language',
    text: '¿Puedo cambiar el idioma durante la charla?',
    translation: 'Can I switch languages during the talk?',
    lang: 'es',
    created: 1,
    votes: 5,
  },
  {
    id: 'latency',
    text: 'How is caption delay measured?',
    lang: 'en',
    created: 2,
    votes: 3,
  },
]

function readRoom() {
  const saved: Question[] = []
  const voted = new Set<string>()
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(voteKey)) voted.add(key.slice(voteKey.length))
      if (!key.startsWith(questionKey)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = questionSchema.safeParse(JSON.parse(raw))
        if (parsed.success) saved.push(parsed.data)
      } catch {
        /* Ignore malformed records from earlier demo sessions. */
      }
    }
  } catch {
    /* The seeded room is readable when browser storage is unavailable. */
  }
  const questions = [
    ...sampleQuestions.map((question) => ({ ...question, mine: false })),
    ...saved.map((question) => ({ ...question, votes: 0, mine: true })),
  ]
    .map((question) => ({
      ...question,
      votes: question.votes + Number(voted.has(question.id)),
      voted: voted.has(question.id),
    }))
    .sort(
      (first, second) =>
        second.votes - first.votes || first.created - second.created,
    )
  return { questions }
}

// The room shell and both question views share this hook.
// oxlint-disable-next-line react/only-export-components
export function useQuestions() {
  const [room, setRoom] = useState(readRoom)
  useEffect(() => {
    const refresh = () => setRoom(readRoom())
    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key.startsWith(roomKey)) refresh()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener(roomKey, refresh)
    refresh()
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(roomKey, refresh)
    }
  }, [])

  function save(key: string, value: string) {
    localStorage.setItem(key, value)
    window.dispatchEvent(new Event(roomKey))
  }
  function post(text: string, lang: Language) {
    const now = Date.now()
    if (
      readRoom().questions.filter(
        (question) => question.mine && now - question.created < 60_000,
      ).length >= 3
    ) {
      throw new Error(
        'You can post three questions per minute. Try again shortly.',
      )
    }
    const question = questionSchema.parse({
      id: crypto.randomUUID(),
      text,
      lang,
      created: now,
      translation:
        lang === 'es' && normalize(text) === normalize(sampleText)
          ? sampleEnglish
          : undefined,
    })
    save(questionKey + question.id, JSON.stringify(question))
  }
  return { ...room, post, vote: (id: string) => save(voteKey + id, '1') }
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// This room replays a known search result against the caption the attendee has received.
function replayCitation(text: string, segments: readonly Segment[]) {
  if (
    !/reconnect|reconect|desconex|conexi[oó]n|connection drops|recover messages/i.test(
      text,
    )
  )
    return
  return segments.find((segment) =>
    /last.event.id|backfill|resume|reconnect/i.test(segment.en),
  )
}

export function Questions({
  model,
  speaker,
  segments,
}: {
  model: ReturnType<typeof useQuestions>
  speaker: boolean
  segments: readonly Segment[]
}) {
  const labelId = useId()
  const inputId = useId()
  const input = useRef<HTMLTextAreaElement>(null)
  const reviewTitle = useRef<HTMLParagraphElement>(null)
  const [mineOnly, setMineOnly] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [lang, setLang] = useState<Language>('en')
  const [review, setReview] = useState<{ citation?: Segment } | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [voteError, setVoteError] = useState('')
  const filtered = model.questions.filter(
    (question) => !mineOnly || question.mine,
  )
  useEffect(() => {
    if (review) reviewTitle.current?.focus()
    else if (open) input.current?.focus()
  }, [review, open])

  function changeOpen(next: boolean) {
    setOpen(next)
    setReview(null)
    setError('')
    if (next) setNotice('')
    else setDraft('')
  }

  function publish() {
    try {
      model.post(draft.trim(), lang)
      changeOpen(false)
      setNotice('Question posted')
    } catch (cause) {
      console.error(cause)
      setError(
        cause instanceof Error && cause.message.startsWith('You can post')
          ? cause.message
          : 'Your question could not be saved in this browser. Your draft is ready to retry.',
      )
    }
  }

  return (
    <section aria-labelledby={labelId} className="qa-panel">
      <header className="qa-heading">
        <MessageSquare size={19} aria-hidden="true" />
        <h2 id={labelId}>Room Q&amp;A</h2>
        <span
          className="qa-count"
          aria-label={`${model.questions.length} questions`}
        >
          {model.questions.length}
        </span>
      </header>
      <div className="qa-filters">
        <span>Most votes first</span>
        {!speaker && (
          <label className="qa-filter">
            <ListFilter size={15} aria-hidden="true" />
            <select
              aria-label="Filter questions"
              value={mineOnly ? 'mine' : 'all'}
              onChange={(event) => setMineOnly(event.target.value === 'mine')}
            >
              <option value="all">All questions</option>
              <option value="mine">My questions</option>
            </select>
          </label>
        )}
      </div>
      <ol className="qa-list">
        {filtered.map((question) => {
          const translated =
            speaker && question.lang === 'es' && question.translation
          return (
            <li key={question.id}>
              <div className="qa-copy">
                <p lang={translated ? 'en' : question.lang}>
                  {translated || question.text}
                </p>
                {translated && <small lang="es">{question.text}</small>}
                {speaker && question.lang === 'es' && !translated && (
                  <small>
                    Original Spanish · English unavailable in replay
                  </small>
                )}
              </div>
              {speaker ? (
                <span
                  className="qa-vote"
                  aria-label={`${question.votes} votes`}
                >
                  <ChevronUp size={14} />
                  {question.votes}
                </span>
              ) : (
                <button
                  type="button"
                  className="qa-vote"
                  aria-pressed={question.voted}
                  disabled={question.voted}
                  aria-label={`${question.voted ? 'Voted for' : 'Vote for'} ${question.text} (${question.votes} votes)`}
                  onClick={() => {
                    try {
                      model.vote(question.id)
                      setVoteError('')
                    } catch (cause) {
                      console.error(cause)
                      setVoteError(
                        'Your vote could not be saved in this browser. Please try again.',
                      )
                    }
                  }}
                >
                  {question.voted ? (
                    <Check size={14} />
                  ) : (
                    <ChevronUp size={14} />
                  )}
                  {question.votes}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      {!filtered.length && (
        <p className="qa-empty">Your posted questions will appear here.</p>
      )}
      {voteError && (
        <Alert>
          <AlertDescription>{voteError}</AlertDescription>
        </Alert>
      )}
      <div className="qa-notice" role="status">
        {notice}
      </div>
      {!speaker && (
        <Dialog.Root open={open} onOpenChange={changeOpen}>
          <Dialog.Trigger asChild>
            <Button className="qa-ask">
              <Plus aria-hidden="true" />
              Ask a question
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="qa-overlay" />
            <Dialog.Content
              className="qa-dialog"
              onOpenAutoFocus={(event) => {
                event.preventDefault()
                input.current?.focus()
              }}
            >
              <div className="qa-dialog-heading">
                <Dialog.Title>Ask a question</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="qa-close" aria-label="Close question">
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="qa-description">
                Check the captions before posting to the room.
              </Dialog.Description>
              {!review ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (draft.trim())
                      setReview({ citation: replayCitation(draft, segments) })
                  }}
                >
                  <div className="qa-language">
                    <label htmlFor={inputId}>Your question</label>
                    <select
                      aria-label="Question language"
                      value={lang}
                      onChange={(event) =>
                        setLang(event.target.value === 'es' ? 'es' : 'en')
                      }
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
                  </div>
                  <textarea
                    ref={input}
                    id={inputId}
                    value={draft}
                    lang={lang}
                    required
                    maxLength={500}
                    rows={4}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="qa-example"
                    onClick={() => {
                      setLang('es')
                      setDraft(sampleText)
                    }}
                  >
                    Use sample question
                  </button>
                  <Button
                    type="submit"
                    className="qa-ask"
                    disabled={!draft.trim()}
                  >
                    Check captions
                  </Button>
                </form>
              ) : (
                <div>
                  <p
                    ref={reviewTitle}
                    tabIndex={-1}
                    className="qa-draft"
                    lang={lang}
                  >
                    {draft.trim()}
                  </p>
                  {review.citation ? (
                    <div className="qa-citation">
                      <strong>
                        Possibly covered at {review.citation.time}
                      </strong>
                      <blockquote lang="en">{review.citation.en}</blockquote>
                      <small>
                        Segment #{String(review.citation.id).padStart(3, '0')} ·
                        Sample score 0.89
                      </small>
                    </div>
                  ) : (
                    <p className="qa-description">
                      No matching caption in this replay.
                    </p>
                  )}
                  {error && (
                    <Alert>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="qa-actions">
                    {review.citation ? (
                      <>
                        <Button onClick={() => changeOpen(false)}>
                          Answered · Dismiss
                        </Button>
                        <Button variant="outline" onClick={publish}>
                          Still ask
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={publish}>Post question</Button>
                        <Button
                          variant="outline"
                          onClick={() => setReview(null)}
                        >
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  )
}
