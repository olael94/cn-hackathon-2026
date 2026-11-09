import { z } from 'zod'

const apiUrl = import.meta.env.VITE_API_URL ?? '/api'

export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`)
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }
  return schema.parse(await response.json())
}

export const healthSchema = z.object({
  status: z.string(),
  version: z.string(),
})

export type Health = z.infer<typeof healthSchema>

export function getHealth(): Promise<Health> {
  return getJson('/health', healthSchema)
}
