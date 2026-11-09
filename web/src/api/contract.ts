import { z } from 'zod'

export const themeSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  question_ids: z.array(z.string()),
  top_question_id: z.string(),
  votes: z.number().int(),
})
export type Theme = z.infer<typeof themeSchema>

export const themeSetSchema = z.strictObject({
  talk_id: z.string(),
  themes: z.array(themeSchema),
  question_count: z.number().int(),
  off_topic_count: z.number().int(),
  built_at: z.iso.datetime(),
})
export type ThemeSet = z.infer<typeof themeSetSchema>
