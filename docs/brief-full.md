# RoomPass: Brief v2

Nov 9, 2026 · @Miguel Elizalde

RoomPass gives every room at a conference what only keynotes get today. Scan one QR code, no account, and your phone shows live captions in English and Spanish, a catch-up for latecomers, and typed Q&A that tells you if your question was already answered. It is built for deaf and hard-of-hearing attendees, second-language listeners, and anyone who won't ask out loud. The caption lag is shown on screen and backed by an SLO, so when translation slows down, we see it, find it, and fix it in seconds.

## Product

We ship captions with visible lag and Q&A matching. Everything else is a stretch goal.

- **Event:** WeMakeDevs Cloud Native Hackathon, Mon Nov 9 2026, The Shop, Salt Lake City. 3 people, about 5 hours, 5-minute demo.
- **Roles:** speaker (private speaker link) and subscriber (room QR). No accounts.

**Must ship**

1. **Live captions** in EN and ES, with the lag on screen ("live · 1.4s behind").
2. **Typed Q&A with a soft match.** "Possibly covered at 12:04" plus the caption line, match score and a **Still ask** button. Works across languages: a Spanish question matches English captions. Phones show the top questions, with a filter. Spanish questions show in English on the speaker view.
3. **Speaker link.** Start button, and press-and-hold 3s to stop so a misclick never ends the talk. Questions sorted by votes. One opt-in switch for saving the transcript.
4. **Accessible app.** Font size, high contrast, screen reader labels, one-handed use, and a "machine captions, may contain errors" label.

**Stretch (only if must-ship is done)**

- **Catch me up:** 3 to 5 bullets on the talk so far, each linked to its caption line.

**Cut:** follow-a-talk, end-of-talk summary, EN/ES question merge, edge mode, join-code rotation, TTL deletion. Also out: chatbot, more than 2 languages, accounts, notifications, schedules, sign language, recordings.

**Rule for AI:** AI transcribes and translates. It never decides what is true. Catch-up bullets must cite existing segment IDs, or code drops them. "Possibly covered" uses Elasticsearch search, no generation.

## Demo (5 minutes, 4 beats)

The demo only uses must-ship features. It runs on our own phones, mirrored on screen. Judges can scan the QR as a bonus, but nothing depends on them.

1. **Problem (30s).** Start with the person: "Who here walked into a talk late, or had a question and didn't ask it?"
2. **Captions with lag (1m30s).** Miguel speaks English. Our phones show Spanish captions and "live · 1.4s behind". Say it: this number is the user-facing side of our SLO.
3. **Q&A match (1m).** The demo room is pre-loaded with the 3-minute test talk. We type a Spanish question about something said in English. It shows "Possibly covered at 12:04" with the English caption line and score. Same query path as any question, no merge logic.
4. **Ops with one real incident (1m30s).** Flip the chaos flag through OpenFeature (flagd). The on-screen lag climbs and the SLO burns in Dash0. Agent0 and Radar's AI point at the translator. Flip the fallback flag, lag recovers in seconds. Then show the real failure we hit today, with screenshots.
5. **Close (30s).** Rooms are data, cost per talk-hour, what's next.

**Backup:** a recorded run of the full demo, in case Wi-Fi or phones fail.

## Architecture

Rooms are data, not deployments: one install serves any number of rooms. Python, one repo, one image, three processes (`python -m roompass api | pipeline | translator`).

&#91;embedded content: RoomPass data flow · 8 parts\]

Redis Streams sits in the middle, so a translator restart loses nothing and phones backfill from it when they reconnect.

| Piece | Job | Why it is separate |
| --- | --- | --- |
| pipeline | Speaker audio over WebSocket (PCM16), speech to text, finished segments to Redis Streams | Scales with rooms |
| translator | OPUS-MT on CTranslate2: EN to ES for captions, ES to EN for questions | Own latency and scaling; the chaos target |
| api | FastAPI: SSE to phones, Q&A, writes to Elasticsearch, speaker link | Scales with viewers |
| Redis Streams | Bus between services, and the source for reconnect backfill | Keeps messages through restarts |
| flagd (OpenFeature) | chaos.translate\_delay\_ms, translate.fallback\_model, stt.provider | Mitigate in seconds, no deploy |
| Phone page | Static page with Dash0 RUM | Nothing to install |

**Decisions**

- **Speech to text, decided at H1:** start on OpenAI realtime (`stt.provider` = openai). Swap in Moonshine Small only if captions already work end to end. No judging criterion rewards self-hosted STT. OPUS-MT stays: low risk, and it is the chaos target.
- **Audio:** PCM16, 16 kHz mono, 20 ms frames over our own hotspot. No Opus.
- **TLS:** a tunnel or the cluster's ingress cert. Avoids Chrome's HTTP warning for judges and lets the speaker page use the mic.
- **Reconnects:** phones resume with SSE Last-Event-ID and backfill from Redis Streams, not Elasticsearch, whose refresh lag can miss the newest segments. Heartbeat every 15s, ingress buffering off.
- **Matching:** BM25 on text\_en and text\_es, plus Jina multilingual semantic\_text on 15s passages. Set inference\_id explicitly. RRF orders results; the shown score and the gate use raw cosine. Show "possibly covered" only when keyword and semantic agree, or semantic is above a high threshold.
- **Talk lifecycle:** Start, then hold 3s to stop. A 5s drain flushes the last line and in-flight translations to Elasticsearch. Timestamps come from the audio sample count, not the wall clock.
- **Subscribers:** a signed anonymous session per room (cookie). One vote per device per question, 3 questions per minute.
- **Python:** FastAPI with sse-starlette. Inference runs in threads, never on the event loop. `traceparent` in every Redis message so each segment is one trace. `opentelemetry-instrument` for FastAPI and Redis.
- **LLM (stretch, catch-up only):** gpt-5.4-mini with structured outputs, cached per talk for 30s.

## Contract (Phase 1, blocking, first 20 minutes)

All 3 agree on this before anyone builds. After it, we work in parallel. Pydantic models are the source; export JSON Schema for the phone page.

- **Segment:** {id, talk\_id, seq, t\_start, t\_end, text\_en, text\_es, emitted\_at}
- **Question:** {id, talk\_id, device\_id, text, lang, text\_en, text\_es, votes, covered\_segment\_id, score, hidden, created\_at}
- **SSE events:** hello (server time, for clock offset), partial (EN only, replaces itself on screen), segment, question
- **Audio WebSocket:** `start {talk_id}`, binary PCM16 frames, `stop`
- **Redis Streams:** one stream per talk for segments, one for questions. Every message carries `traceparent`.
- **Elasticsearch indices:** segments, passages, questions, talks (has opt\_in and speaker\_token\_hash)
- **Flags:** chaos.translate\_delay\_ms, translate.fallback\_model, stt.provider
- **Lag SLO:** lag = phone receive time - (started\_at + t\_end), corrected with the hello clock offset. p95 under 3s.

## Build order

The speech-to-text decision happens at H1, so the rest of the day builds on captions that already work.

| When | Done means |
| --- | --- |
| H0 | Contract agreed. Rules tab checked. All accounts live. Repo, .gitar/review/, CI. 3-minute test talk recorded. |
| H1 | Skeleton on Radar's cluster through Argo CD, with TLS. OTel flowing to Dash0. ES project up. English captions from OpenAI realtime through the pipeline. **STT gate:** stay on OpenAI; Moonshine only if captions already work end to end. |
| H2 | Captions EN + ES on a phone, from the cluster, on a public HTTPS URL. Test talk pre-loaded into the demo room. |
| H3 | Lag on screen and the SLO in Dash0. Q&A soft match, including a Spanish question against English captions. Speaker view with opt-in. |
| H4 | Thresholds tuned on about 10 EN/ES pairs and 10 unrelated questions. Chaos and fallback flags rehearsed. Catch-up if time. |
| H4.5 | Fresh-session persona audit. 45 min of phone-page polish. |
| H5 | Rehearse twice. Record the backup video. Feature freeze. |

**Cut order if late:** catch-up, then the Moonshine swap, then the question filter. **Never cut:** captions with lag, Q&A match, the ops story.

**What's next slide:** self-hosted Moonshine on CPU, edge and offline modes, follow-a-talk and summaries, EN/ES question merge, TTL deletion for talks without opt-in, join-code rotation, more languages, classrooms.

## Owners

Miguel keeps the platform and the ops story. Gitar rules, docs/tools/ and the backup video move to the other two.

| Owner | Pieces |
| --- | --- |
| Pipeline | pipeline (STT), translator (OPUS-MT), Gitar review rules, backup video |
| App | api, Elasticsearch, phone page, speaker view, docs/tools/ |
| Platform (Miguel) | Cluster, Argo CD, TLS, Dash0, flagd, CI, presents the ops story |

**Everyone:** screenshot your own incidents as they happen and drop them in docs/tools/. Dash0 and Radar both want a real issue found during the day.

## Sponsor proof and positioning

Merge Forward, Elasticsearch and Dash0 are the natural fits. Radar and Gitar support the story. We pitch the person first and the tools second.

**Positioning**

- **Lead with the person, not the tools.** "Every sponsor tool drives a real decision" is our internal goal, not the pitch. Kelsey Hightower is known for valuing simplicity, so tool-stuffing may read badly.
- **The on-screen lag is the bridge to ops.** "Live · 1.4s behind" is the user-facing side of the SLO, which matches Dash0's "part of the product experience" criterion.
- **Name OpenFeature out loud.** Simon Schrottner works in feature flags.
- **Staged chaos is not enough.** Dash0 and Radar both ask for a real issue found during the day. Capture the first real failure with screenshots.

**Proof per tool** (each gets docs/tools/\<tool>.md: what it helped with, the decisions it drove, screenshots; the README ends with 2 to 3 short stories from the day)

- **Dash0:** one trace per segment, audio to phone. GenAI semantic conventions on the OpenAI spans. Cost per talk-hour. Lag histogram, correlated logs, Dash0 Operator, SLO p95 under 3s. Agent0 or MCP finds one real issue.
- **Elasticsearch:** Elastic Cloud Serverless. Segments, passages and questions live there. Hybrid search powers cross-language Q&A matching.
- **Radar:** their cluster. Deploys through Radar MCP and Argo CD. Sizing decisions logged. One AI investigation on a real failure, and what we changed.
- **Gitar:** review rules (catch-up bullets cite segment IDs, captions path changes need the latency test, no PII in logs). Every feature is a PR. Log findings taken and rejected. One real CI fix through auto-apply.
- **AI disclosure:** a README section on how coding agents were used and how we checked their work.

Only two tests, both enforced by Gitar rules: the captions path latency check, and the citation validator if catch-up ships.

## Risks and open questions

**Risks**

- **Venue Wi-Fi:** our own hotspot for the audio laptop, our phones on cellular, SSE resume from Redis Streams. Backup video.
- **No TLS:** Chrome may warn judges before loading a public HTTP site, and the speaker page can't use the mic. TLS is part of H1.
- **STT or translation slow:** the lag on screen shows it, and it becomes the ops moment.
- **Judges' phones:** twelve judges scanning and typing takes 60+ seconds. The demo runs on our phones; judges scanning is a bonus.
- **One person bottleneck:** owners are rebalanced so Miguel only carries the platform and the ops story.

**Open questions**

- **Best Overall:** does it need every sponsor tool? The prize page says "from any track". Check the Rules tab at H0 before spreading thin.
- Tunnel or the cluster's ingress cert for TLS
- Demo length and Q&A time
- Radar namespace limits for streaming workers
- Similarity thresholds (tune at H4)
- Final name
