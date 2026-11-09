import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { DemoReplay } from '@/api/contract'
import { demoPath, demoRoom, newId } from '@/api/demo'

const schema = z.object({
  revision: z.number().int(),
  started_ms: z.number().nullable(),
  stopped_ms: z.number().nullable(),
  server_ms: z.number(),
}) satisfies z.ZodType<DemoReplay>
const key = ['demo-replay', demoRoom]
type Action = 'start' | 'stop' | 'reset'
let token: string | undefined

function speakerToken() {
  if (!token) {
    const storageKey = 'roompass:demo:speaker'
    try {
      token = localStorage.getItem(storageKey) || newId()
      localStorage.setItem(storageKey, token)
    } catch {
      token ??= newId()
    }
  }
  return token
}

async function request(suffix: string, options: RequestInit) {
  const sent = performance.now()
  const response = await fetch(demoPath + '/replay' + suffix, { ...options, cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 403) throw new Error('Use the speaker browser that started this replay.')
    if (response.status === 409) throw new Error('The room changed. Check its status and try again.')
    throw new Error('Could not update the room. Check your connection and try again.')
  }
  const state = schema.parse(await response.json())
  // Anchor server time to the monotonic browser clock, even if a phone's wall clock is wrong.
  return { ...state, anchor: (sent + performance.now()) / 2 }
}

export function useReplay() {
  const client = useQueryClient()
  const state = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => request('', { signal }),
    refetchInterval: 1000,
    retry: false,
  })
  const control = useMutation({
    networkMode: 'always',
    mutationFn: (action: Action) => request('/' + action + '?revision=' + state.data?.revision, {
      method: 'POST',
      headers: { 'X-Speaker-Token': speakerToken() },
    }),
    onSuccess: async (next) => {
      await client.cancelQueries({ queryKey: key })
      client.setQueryData<typeof next>(key, (old) => old && old.revision > next.revision ? old : next)
    },
    onError: (error) => {
      console.error('Replay control failed', error)
      void client.invalidateQueries({ queryKey: key })
    },
  })
  return { state, control }
}
