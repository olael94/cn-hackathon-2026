# RoomPass Contract

This file is the agreement between `backend/` and `web/`. Build against it in parallel.
Changing anything here is "ask the team first", and the change lands in the same PR as the code.

- Backend: pydantic models in `backend/roompass/contract.py` mirror this file.
- Frontend: zod schemas in `web/src/api/contract.ts` mirror this file.
- Every path is under `/api`, because nginx in `web/` only forwards `/api/` to the backend.

## Conventions

- `talk_id`: 6 lowercase letters or digits, for example `k8s7fa`. It is also the room join code in the QR URL.
- Offsets (`t_start`, `t_end`) are **seconds from talk start** (float), counted from the audio the speaker sent, not the wall clock.
- Absolute times are ISO 8601 UTC strings, for example `2026-11-09T21:04:12.381Z`.
- `lang` is `"en"` or `"es"`. The speaker speaks English for now.
- Errors use the FastAPI default body: `{"detail": "human readable message"}`.
- No accounts. Two roles:
  - **Speaker:** has `speaker_token`, sent as header `X-Speaker-Token`.
  - **Viewer:** has a random `device_id` (UUID kept in `localStorage`), sent as header `X-Device-Id`.

## Front-end routes

| Route | Who | What |
|---|---|---|
| `/t/{talk_id}` | Viewer (room QR) | Captions, catch-up, Q&A |
| `/s/{talk_id}#token={speaker_token}` | Speaker (private link) | Record button, questions by votes |

The token sits in the URL hash so it never reaches server logs.

## Shapes

### Talk
```json
{
  "talk_id": "k8s7fa",
  "title": "Scaling Kubernetes Without Tears",
  "speaker_name": "Miguel",
  "room": "Room 2",
  "status": "waiting",
  "started_at": null,
  "ended_at": null
}
```
`status` is `"waiting"`, `"live"` or `"ended"`. `started_at` is set when the speaker taps Start.

### Segment
One finished caption line, from one audio chunk.
```json
{
  "id": "k8s7fa-12",
  "talk_id": "k8s7fa",
  "seq": 12,
  "t_start": 60.0,
  "t_end": 65.0,
  "text_en": "Autoscaling only helps if your requests are set correctly.",
  "text_es": "El autoescalado solo ayuda si tus solicitudes están bien configuradas.",
  "emitted_at": "2026-11-09T21:04:12.381Z"
}
```
- `id` is always `{talk_id}-{seq}`. `seq` starts at 0 and increases by 1 per chunk. If the backend skips a `seq` as described under Audio chunks, it produces no `Segment` for it and never reuses its id.
- `text_es` may be `null` if translation failed. The phone shows English with a "translation unavailable" note.

### Question
```json
{
  "id": "q_8f2c1a",
  "talk_id": "k8s7fa",
  "text": "¿Cómo se configuran las solicitudes?",
  "lang": "es",
  "text_en": "How do you configure requests?",
  "votes": 3,
  "created_at": "2026-11-09T21:06:40.002Z"
}
```
`text_en` equals `text` when `lang` is `"en"`. The speaker view shows `text_en`.

### Match
One caption line that might already answer a question.
```json
{
  "segment_id": "k8s7fa-12",
  "seq": 12,
  "t_start": 60.0,
  "text_en": "Autoscaling only helps if your requests are set correctly.",
  "text_es": "El autoescalado solo ayuda si tus solicitudes están bien configuradas.",
  "score": 0.83,
  "keyword_hit": true
}
```
`score` is the Elasticsearch `_score` of the semantic sub-query alone (for cosine dense vectors: `(1 + cos) / 2`, 0 to 1), not the RRF score. RRF is used only to order `matches`. The backend decides "possibly covered" with plain code, never an LLM.

### CatchUp
```json
{
  "talk_id": "k8s7fa",
  "lang": "en",
  "bullets": [
    { "text": "Requests decide where pods land and when autoscaling kicks in.", "segment_ids": ["k8s7fa-10", "k8s7fa-12"] }
  ],
  "through_seq": 14,
  "generated_at": "2026-11-09T21:05:00.000Z"
}
```
- Every bullet cites at least one existing `segment_id`. The backend drops any bullet that doesn't (the citation validator).
- Cached per talk and language for 30 s.

### ThemeSet
The 4 or 5 themes that cover most of the questions, for the speaker to answer in groups. It adds to the question list, it never replaces it.
```json
{
  "talk_id": "k8s7fa",
  "themes": [
    {
      "id": "th_3",
      "label": "Setting resource requests for autoscaling",
      "question_ids": ["q_8f2c1a", "q_1b9e04", "q_77ad20"],
      "top_question_id": "q_8f2c1a",
      "votes": 9
    }
  ],
  "question_count": 14,
  "off_topic_count": 2,
  "built_at": "2026-11-09T21:08:00.000Z"
}
```
- At most 5 themes, most `votes` first. `votes` is the sum over `question_ids`.
- Off topic: a question whose best semantic score against the talk's segments is under `0.65` (`score` is `(1 + cos) / 2`, so 0.5 means no similarity at all; tune on the 10 seeded unrelated questions). It stays in the question list, but no theme includes it.
- Grouping is plain code: take the on-topic questions by votes, each ungrouped one starts a theme and pulls in ungrouped questions with semantic score `>= 0.75` against it. Themes of one question are dropped. Tune both cutoffs on the seeded questions.
- `label` is written by a model from the `text_en` of the theme's questions and must cite only that theme's `question_ids`. If it doesn't, or the call fails, `label` is the top question's `text_en`.
- Rebuilt after every 5 new questions or 60 s, whichever comes first, and only if questions or votes changed.

## Endpoints

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/talks` | none | `{title, speaker_name, room}` | `{talk: Talk, speaker_token}` (token is returned only here) |
| GET | `/api/talks/{talk_id}` | none | | `Talk` |
| POST | `/api/talks/{talk_id}/start` | speaker | | `Talk` (status `live`) |
| POST | `/api/talks/{talk_id}/stop` | speaker | | `Talk` (status `ended`) |
| POST | `/api/talks/{talk_id}/audio` | speaker | multipart: `file` (audio/webm), `seq` (int), `t_start` (float), `t_end` (float) | `202 {"seq": 12}` |
| GET | `/api/talks/{talk_id}/segments?after_seq=N` | none | | `Segment[]` with `seq > N`, oldest first (omit `after_seq` for all) |
| GET | `/api/talks/{talk_id}/events` | none | SSE, see below | stream |
| POST | `/api/talks/{talk_id}/questions/check` | viewer | `{text, lang}` | `{covered: bool, matches: Match[]}` (top 3) |
| POST | `/api/talks/{talk_id}/questions` | viewer | `{text, lang}` | `Question` |
| POST | `/api/talks/{talk_id}/questions/{question_id}/vote` | viewer | | `Question` (one vote per device, repeat votes are ignored) |
| GET | `/api/talks/{talk_id}/questions` | none | | `Question[]`, most votes first |
| GET | `/api/talks/{talk_id}/catchup?lang=en` | none | | `CatchUp` |
| GET | `/api/talks/{talk_id}/themes` | none | | `ThemeSet` (empty `themes` until there are 2 related questions) |
| GET | `/api/health` | none | | `{status, version}` (already built) |

Status codes: `401` bad or missing speaker token, `404` unknown talk, `409` talk not live (audio or questions on a talk that isn't live), `429` more than 3 questions per minute from one device.

### Audio chunks
- Send whatever `MediaRecorder` produces (webm/opus). No resampling needed.
- **Restart `MediaRecorder` every 5 s** so each chunk is a complete file with its own header. Do not use `timeslice`.
- The speaker page computes `t_start` and `t_end` from when each recorder started and stopped, relative to the Start tap.
- The backend processes chunks in `seq` order per talk. If chunk N has not arrived or finished processing 10 s after chunk N+1 arrived, the backend skips N, emits no segment for it, and continues with N+1. A late N is discarded. Timing uses the server clock, and stopping a talk flushes any pending gap the same way.

## SSE stream: `GET /api/talks/{talk_id}/events`

Each event has an `event:` name and a JSON `data:` line.

| Event | `id:` | Data | When |
|---|---|---|---|
| `hello` | none | `{server_time, talk: Talk, questions: Question[]}` | First event on every connect |
| `segment` | `seq` | `Segment` | A new caption line |
| `question` | none | `Question` | New question or new vote count |
| `talk` | none | `Talk` | Status changes (`live`, `ended`) |
| `themes` | none | `ThemeSet` | After each rebuild |

- A `: ping` comment every 15 s keeps proxies from closing the stream.
- **Reconnect:** the browser sends `Last-Event-ID` (the last segment `seq`). The backend replays segments with a higher `seq` from its in-memory per-talk buffer first, falling back to Elasticsearch for older ones (deduped by `seq`), then continues live. The buffer covers published segments not yet visible in Elasticsearch; sequences skipped under Audio chunks produce no segment and cannot be replayed.
- Clock offset: `offset = server_time - Date.now()` at `hello`.

## Lag (the Dash0 SLO)

```
lag_seconds = (Date.now() + offset) - (talk.started_at + segment.t_end)
```
- The phone shows it as "live · 6.2s behind".
- The phone reports it to Dash0 RUM as `roompass.caption.lag` (seconds) with attribute `talk.id`.
- **SLO: p95 under 10 s.**

## Telemetry names (for Dash0 dashboards)

Backend spans, one trace per audio chunk:

| Span | Attributes |
|---|---|
| `pipeline.transcribe` | `talk.id`, `segment.seq`, `gen_ai.request.model`, `audio.duration_s` |
| `pipeline.translate` | `talk.id`, `segment.seq`, `gen_ai.request.model` |
| `pipeline.index` | `talk.id`, `segment.seq` |
| `pipeline.publish` | `talk.id`, `segment.seq`, `sse.subscribers` |
| `catchup.generate` | `talk.id`, `catchup.bullets_returned`, `catchup.bullets_dropped` |
| `questions.check` | `talk.id`, `match.top_score`, `match.covered` |
| `themes.build` | `talk.id`, `themes.count`, `questions.count`, `questions.off_topic`, `themes.labels_dropped`, `gen_ai.request.model` |

Never put transcript text or question text in span attributes or logs. IDs, counts and timings only.

## Elasticsearch indices (Elastic Cloud Serverless)

| Index | Document id | Key fields |
|---|---|---|
| `talks` | `talk_id` | `title`, `speaker_name`, `room`, `status`, `started_at`, `ended_at`, `speaker_token_hash` (keyword) |
| `segments` | `{talk_id}-{seq}` | `talk_id` (keyword), `seq` (int), `t_start`, `t_end` (float), `text_en` (text, english analyzer), `text_es` (text, spanish analyzer), `semantic` (`semantic_text` with an explicit **multilingual** `inference_id`), `emitted_at` (date) |
| `questions` | `id` | `talk_id` (keyword), `text`, `lang`, `text_en`, `votes` (int), `voters` (keyword array of device ids), `created_at`, `semantic` (`semantic_text`, same `inference_id` as `segments`), `topic_score` (float) |

- `semantic` holds `text_en`, so English and Spanish questions both match it. On `questions` it is used to group questions into themes.
- "Possibly covered" = BM25 on `text_en` and `text_es` plus semantic on `semantic`, combined with RRF for ordering. `covered` is true only when the top RRF-ordered match is a keyword hit with semantic `score >= 0.6`, or has semantic `score >= 0.8`. Tune these on about 10 seeded pairs.

## Who owns what

| Area | Owner | Files |
|---|---|---|
| Pipeline + Elasticsearch | Oliver | `backend/` (pipeline, search, catch-up) |
| Phone and speaker views | Frontend teammate | `web/src/` |
| Platform, Dash0, Radar, Gitar | Miguel | `deploy/`, `.github/`, `.gitar/`, telemetry setup, `docs/tools/` |
| Question themes | Miguel | `backend/roompass/themes/` |

Shared: `CONTRACT.md`, `backend/roompass/contract.py`, `web/src/api/contract.ts`. Change them only with the team's OK.
