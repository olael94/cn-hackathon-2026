# RoomPass

Every room at a conference gets what only keynotes get today. Scan one QR code, no account, and your phone shows live captions in English and Spanish, with the caption lag on screen, and typed Q&A that tells you if your question was already answered.

Built for deaf and hard-of-hearing attendees, second-language listeners, and anyone who won't ask out loud. Built at the WeMakeDevs Cloud Native Hackathon, Salt Lake City, November 9 2026, by a team of 3.

**Live:** https://the-mok-team.cnh.radarhq.io

> **Status:** live captions run end to end on the public URL: about 2 s from a 5 s audio chunk to English and Spanish captions on a phone. "Possibly covered" runs as hybrid search over the real captions. See [the plan](plans/00-general.md) for what was cut.

## What it does

| Feature | What you see |
|---------|--------------|
| Live captions | English and Spanish on your phone, with "live · 1.4s behind" |
| Q&A soft match | Type a question; "Possibly covered at 12:04" shows the caption line and score, with a **Still ask** button. A Spanish question matches English captions. |
| Speaker link | Start, press and hold 3 seconds to stop, questions sorted by votes |
| Accessible | Font size, high contrast, screen reader labels, one-handed use, "machine captions, may contain errors" |

AI transcribes and translates. It never decides what is true: "possibly covered" is an Elasticsearch search, not generated text.

## Demo

1. **Captions with lag.** The speaker talks in English; phones show Spanish captions and the lag. That number is the user-facing side of our SLO.
2. **Q&A match.** A Spanish question about something said in English comes back "Possibly covered" with the English line and its score.
3. **Ops.** Dash0 shows the trace of one caption from audio to phone and the lag SLO. Then the real incident we hit today, what Dash0 or Radar found, and the PR that fixed it.

## How it works

```text
speaker mic ──5 s audio chunks (HTTP POST)──> api (FastAPI)
                                               │  OpenAI transcription (EN)
                                               │  OpenAI translation (EN -> ES)
                                               ├──> Elasticsearch (talks, segments, questions)
phone page <──────────── SSE ─────────────────┘
```

Rooms are data, not deployments: one install serves any number of rooms. The full contract between the api and the phone page is in [CONTRACT.md](CONTRACT.md).

### Captions, step by step

1. The speaker page records 5 s webm/opus chunks and posts each one with its `seq` and offsets from talk start.
2. `backend/roompass/pipeline.py` sends it to OpenAI `gpt-4o-mini-transcribe` (English), then translates the line with `gpt-4.1-mini` (Spanish). If translation fails, the English line still goes out with `text_es: null`.
3. Lines are published in `seq` order. A chunk that fails is skipped, and one that never arrives is skipped 10 s after the next one, so captions never stall.
4. Each line goes to every phone over SSE first, then into Elasticsearch.
5. A phone that drops off Wi-Fi reconnects with `Last-Event-ID` and gets the lines it missed, from memory first, then from Elasticsearch.

### "Possibly covered", step by step

`search.check_question()` runs keyword search (BM25, English and Spanish analyzers) and multilingual semantic search (`.jina-embeddings-v3`) over the talk's captions at the same time, merges them with reciprocal rank fusion, and marks the question covered when the top line's semantic score passes a cutoff. A Spanish question matches an English caption because the embeddings are multilingual. Cutoffs, the 8-question test and its scores are in [docs/tools/elasticsearch.md](docs/tools/elasticsearch.md).

## AI disclosure

- **In the product:** OpenAI transcribes and translates. A model writes question-theme labels. No model decides whether a question is covered or which questions group together: Elasticsearch scores and plain code do.
- **Building it:** we used Claude Code and Codex as coding agents. For the captions pipeline and Elasticsearch search, Claude Code assisted the code; we checked it with live tests against our real Elastic and OpenAI accounts (spoken clips through the pipeline, reconnect replay, a missing-chunk skip, and the 8-question match test) before every merge. Gitar reviewed every PR (findings in [docs/tools/gitar.md](docs/tools/gitar.md)).

## Known limits

- Captions lag by about one chunk (5 s) plus processing, because audio is sent in 5 s chunks rather than streamed.
- One backend replica: live fan-out is in memory. More replicas need a shared pub/sub such as Redis.
- Anyone can create a talk and upload audio, which costs OpenAI credits. There is no rate limit yet.
- Match cutoffs were tuned on 8 questions.

## Repo layout

```text
web/       phone page and speaker view: Vite, React, Tailwind, shadcn/ui, Dash0 web SDK
backend/   Python package roompass: python -m roompass api (api, audio pipeline and SSE in one process)
schema/    JSON Schema for every shape in CONTRACT.md; scripts/gen-types.sh generates both sides
deploy/    Kubernetes manifests Argo CD syncs to our cluster
plans/     general plan and one file per phase
brief/     the product brief every phase builds against
docs/      the full brief, sponsor tool notes, the Radar starter guide
```

## Sponsor tools

| Tool | What it does here |
|------|-------------------|
| [Elasticsearch](docs/tools/elasticsearch.md) | Stores talks, segments and questions. Hybrid search (BM25 + multilingual semantic) powers cross-language Q&A matching. |
| [Dash0](docs/tools/dash0.md) | One trace per caption segment, audio to phone. Lag SLO (p95 under 10 s), real-user monitoring on the phone page. |
| [Radar](docs/tools/radar.md) | Runs on our team's Kubernetes cluster; deploys through Argo CD and Radar's MCP; AI investigations on real failures. |
| [Gitar](docs/tools/gitar.md) | Every feature lands through a reviewed PR, with project review rules. |

## Run it locally

```bash
cd backend && uv sync && uv run python -m roompass api
cd web && pnpm install && pnpm dev
```

Open http://localhost:5173. The web dev server sends `/api` to the backend on port 8000.

## Deploy

Merging to `main` builds the `web` and `backend` images, and Argo CD deploys them to namespace `team-the-mok-team`. The Radar track setup and cluster guide are in [docs/radar-starter.md](docs/radar-starter.md).
