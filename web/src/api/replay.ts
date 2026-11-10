import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { DemoReplay } from '@/api/contract'
import { demoPath, demoRoom, newId } from '@/api/demo'
import { liveSpeaker, saveSpeaker, startLiveTalk, stopLiveTalk } from '@/api/liveTalk'

const schema = z.object({
  revision: z.number().int(),
  voice_id: z.string().nullable().optional(),
  started_ms: z.number().nullable(),
  stopped_ms: z.number().nullable(),
  server_ms: z.number(),
}) satisfies z.ZodType<DemoReplay>
const key = ['demo-replay', demoRoom]
type Action = 'start' | 'voice' | 'stop' | 'reset'
let token: string | undefined

export function speakerToken() {
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
    if (response.status === 503) throw new Error('The live caption service is unavailable. Try again or select Sample replay.')
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
    mutationFn: async (action: Action) => {
      const headers: Record<string, string> = { 'X-Speaker-Token': speakerToken() }
      const revision = '?revision=' + state.data?.revision
      if (action === 'voice') {
        const session = await startLiveTalk()
        headers['X-Live-Speaker-Token'] = session.token
        try {
          const next = await request('/start' + revision + '&talk_id=' + session.id, {method: 'POST', headers})
          saveSpeaker(session)
          return next
        } catch (error) {
          const room = await request('', {}).catch(() => undefined)
          if (room?.voice_id === session.id) { saveSpeaker(session); return room }
          await stopLiveTalk(session)
          throw error
        }
      }
      const session = state.data?.voice_id ? liveSpeaker(state.data.voice_id) : undefined
      if (action === 'stop' && session) {
        await stopLiveTalk(session)
        headers['X-Live-Speaker-Token'] = session.token
      }
      return request('/' + action + revision, {method: 'POST', headers})
    },
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
