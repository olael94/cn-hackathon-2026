# RoomPass

Every room at a conference gets what only keynotes get today. Scan one QR code, no account, and your phone shows live captions in English and Spanish, with the caption lag on screen, and typed Q&A that tells you if your question was already answered.

Built for deaf and hard-of-hearing attendees, second-language listeners, and anyone who won't ask out loud. Built at the WeMakeDevs Cloud Native Hackathon, Salt Lake City, November 9 2026, by a team of 3.

**Live:** https://the-mok-team.cnh.radarhq.io

> **Status:** scaffold. The web page, the FastAPI api and the deploy pipeline run end to end. Captions, translation and Q&A are being built today (see [the plan](plans/00-general.md)).

## What it does

| Feature | What you see |
|---------|--------------|
| Live captions | English and Spanish on your phone, with "live · 6.2s behind" |
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
| Elasticsearch | Stores talks, segments and questions. Hybrid search (BM25 + multilingual semantic) powers cross-language Q&A matching. |
| Dash0 | One trace per caption segment, audio to phone. Lag SLO (p95 under 10 s), real-user monitoring on the phone page. |
| Radar | Runs on our team's Kubernetes cluster; deploys through Argo CD and Radar's MCP; AI investigations on real failures. |
| Gitar | Every feature lands through a reviewed PR, with project review rules. |

## Run it locally

```bash
cd backend && uv sync && uv run python -m roompass api
cd web && pnpm install && pnpm dev
```

Open http://localhost:5173. The web dev server sends `/api` to the backend on port 8000.

## Deploy

Merging to `main` builds the `web` and `backend` images, and Argo CD deploys them to namespace `team-the-mok-team`. The Radar track setup and cluster guide are in [docs/radar-starter.md](docs/radar-starter.md).
