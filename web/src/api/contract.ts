// Shared shapes from CONTRACT.md. Import them from here, never from types/generated/ directly.
// The types are generated from schema/*.json by scripts/gen-types.sh. Change the schema, then
// regenerate; don't edit or redefine them here.

export type { Bullet, CatchUp } from '@/types/generated/catchup'
export type { CapturePosition } from '@/types/generated/capture_position'
export type { Health } from '@/types/generated/health'
export type { DemoGroup, DemoDetail } from '@/types/generated/demo_group'
export type { DemoContribution } from '@/types/generated/demo_contribution'
export type { DemoCheck } from '@/types/generated/demo_check'
export type { DemoReview } from '@/types/generated/demo_review'
export type { DemoReplay } from '@/types/generated/demo_replay'
export type { Match } from '@/types/generated/match'
export type { Question } from '@/types/generated/question'
export type { Segment } from '@/types/generated/segment'
export type { Talk } from '@/types/generated/talk'
export type { Theme, ThemeSet } from '@/types/generated/themeset'
export type { TranslateRequest } from '@/types/generated/translate_request'
export type { TranslateResponse } from '@/types/generated/translate_response'
