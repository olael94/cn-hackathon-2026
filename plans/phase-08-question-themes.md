# Phase 08: Question themes

**Goal:** the speaker gets the 4 or 5 themes that cover most audience questions, next to the normal question list.
**Brief requirements covered:** §8 nice to have "Question themes"; §10 AI approach (model writes labels only).
**Depends on:** 01 (contract), 03 (questions index and SSE fan-out in the App lane)
**Touches only:** `backend/roompass/themes/`, `backend/roompass/contract.py`, `web/src/api/contract.ts`, one router mount in `backend/roompass/api.py`, `backend/pyproject.toml`

## Checklist

- [ ] `Theme` and `ThemeSet` in `contract.py` (pydantic) and `contract.ts` (zod)
- [ ] Pure grouping: on topic if `topic_score >= 0.65`, group by votes with neighbor score `>= 0.75`, drop single-question themes, max 5 by summed votes
- [ ] Elasticsearch: topic score of each question against the talk's `segments`, stored as `topic_score`; neighbor scores on `questions.semantic`, filtered to the talk
- [ ] Labels from `gpt-5.4-mini` with structured output; accepted only if every cited id is in the theme; retry once, else the top question's `text_en`; count dropped labels
- [ ] Scheduler: rebuild after 5 new questions or 60 s, only when something changed; hook `note_question_change` and publish callback `on_themes` for the App lane
- [ ] `GET /api/talks/{talk_id}/themes`, empty `ThemeSet` when Elasticsearch is not configured
- [ ] `themes.build` span with the contract's attributes, no question text
- [ ] One pytest for grouping and the citation check

## Assumptions made

- The App lane calls `await note_question_change(talk_id, new_question)` from async handlers and registers its SSE fan-out with `on_themes`.
- An unknown `talk_id` returns an empty `ThemeSet`, not `404`, so themes need no talks lookup.
- Semantic scores on Elastic serverless are `(1 + cos) / 2`, so `0.65` is cos 0.3 and `0.75` is cos 0.5. Tune on the seeded questions.
- Gated as "H4, after 06 and only if 05 is on track": the PR stays open until then.

## Done when

- [ ] `GET /api/talks/{talk_id}/themes` returns themes for the seeded demo room
- [ ] Report written: what you clicked, what you saw
- [ ] Waiting for me to say commit
