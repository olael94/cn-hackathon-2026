// Shared shapes from CONTRACT.md. Import them from here, never from types/generated/ directly.
// The types are generated from schema/*.json by scripts/gen-types.sh. Change the schema, then
// regenerate; don't edit or redefine them here.

export type { Bullet, CatchUp } from '@/types/generated/catchup'
export type { Health } from '@/types/generated/health'
export type { Match } from '@/types/generated/match'
export type { Question } from '@/types/generated/question'
export type { Segment } from '@/types/generated/segment'
export type { Talk } from '@/types/generated/talk'
export type { Theme, ThemeSet } from '@/types/generated/themeset'
