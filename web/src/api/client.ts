import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { Health } from '@/types/generated/health'

const apiUrl = import.meta.env.VITE_API_URL ?? '/api'

export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`)
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }
  return schema.parse(await response.json())
}

const healthSchema: z.ZodType<Health> = z.strictObject({
  status: z.string(),
  version: z.string(),
})

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => getJson('/health', healthSchema) })
}
