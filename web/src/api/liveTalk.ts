import { z } from 'zod'
import { demoRoom } from '@/api/demo'

export const talksUrl = (import.meta.env.VITE_API_URL ?? '/api') + '/talks'
const credentials = z.object({
  id: z.string(), token: z.string(), next: z.number().int(), elapsed: z.number().nonnegative().optional(),
})
type SpeakerSession = z.infer<typeof credentials>
const key = 'roompass:live-speaker:' + demoRoom
let current: SpeakerSession | undefined

export function liveSpeaker(id: string) {
  if (!current) {
    try { current = credentials.parse(JSON.parse(localStorage.getItem(key) ?? 'null')) } catch { /* No saved speaker. */ }
  }
  return current?.id === id ? current : undefined
}

export function saveSpeaker(session: SpeakerSession) {
  current = session
  try { localStorage.setItem(key, JSON.stringify(session)) } catch { /* Keep this session in memory. */ }
}

async function transition(session: SpeakerSession, action: 'start' | 'stop') {
  const response = await fetch(talksUrl + '/' + session.id + '/' + action, {
    method: 'POST', headers: {'X-Speaker-Token': session.token},
  })
  if (!response.ok) throw new Error('Could not update the room. Check your connection and try again.')
}

export async function startLiveTalk() {
  const response = await fetch(talksUrl, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({title: 'Live captions', speaker_name: 'Speaker', room: demoRoom}),
  })
  if (!response.ok) throw new Error('The live caption service is unavailable. Try again or select Sample replay.')
  const created = z.object({talk: z.object({talk_id: z.string()}), speaker_token: z.string()}).parse(await response.json())
  const session = {id: created.talk.talk_id, token: created.speaker_token, next: 0, elapsed: 0}
  await transition(session, 'start')
  return session
}

export function stopLiveTalk(session: SpeakerSession) {
  return transition(session, 'stop')
}
