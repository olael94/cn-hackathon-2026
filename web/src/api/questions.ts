import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { demoPath, demoRoom as room, newId } from '@/api/demo'
import type { DemoCheck, DemoContribution, DemoGroup, DemoReview } from '@/api/contract'

const detail = z.object({
  id: z.string(),
  text: z.string(),
  lang: z.enum(['es', 'en']),
  votes: z.number().int(),
  voted: z.boolean(),
})
const queue = z.array(
  detail.extend({
    mine: z.boolean(),
    translation: z.string().nullable(),
    segment: z.number().nullable(),
    expansions: z.array(detail),
    formulations: z.array(z.string()),
  }),
) satisfies z.ZodType<DemoGroup[]>
const review = z.object({
  target: z.string().nullable(),
  segment: z.number().nullable(),
  source: z.enum(['elasticsearch', 'replay']),
  score: z.number().nullable(),
  suggestion: z.enum(['support', 'expand', 'ask']).nullable(),
}) satisfies z.ZodType<DemoReview>
export type Review = z.infer<typeof review>
export type Action = DemoContribution['action']

let temporaryDevice: string | undefined
function deviceId() {
  temporaryDevice ??= newId()
  try {
    const key = 'roompass:qa:device'
    const stored = localStorage.getItem(key)
    if (stored && z.uuid().safeParse(stored).success) return stored
    localStorage.setItem(key, temporaryDevice)
  } catch {
    /* Keep the same identity for the lifetime of this tab. */
  }
  return temporaryDevice
}

const path = demoPath + '/questions'
async function request<T>(
  suffix: string,
  schema: z.ZodType<T>,
  body?: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch(path + suffix, {
    method: body ? 'POST' : 'GET',
    signal,
    cache: 'no-store',
    headers: { 'X-Device-Id': deviceId(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'You can post three questions per minute.'
        : 'Could not reach the shared queue. Please try again.',
    )
  }
  return schema.parse(await response.json())
}

export function useQuestions() {
  const client = useQueryClient()
  const key = ['demo-questions', room]
  const state = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => request('', queue, undefined, signal),
    refetchInterval: 1000,
    retry: 1,
  })
  async function submit(contribution: DemoContribution) {
    const next = await request('', queue, contribution)
    await client.cancelQueries({ queryKey: key })
    client.setQueryData(key, next)
    void client.invalidateQueries({ queryKey: key })
  }
  return {
    questions: state.data ?? [],
    loading: state.isPending,
    failed: state.isError,
    check: (text: string) => request('/check', review, { text } satisfies DemoCheck),
    submit,
  }
}
