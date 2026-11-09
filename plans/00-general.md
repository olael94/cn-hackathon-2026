# General Plan

**Source:** `brief/brief.md`, filled from `docs/RoomPass Brief.md` (Brief v2).

**Demo path (one sentence):** Miguel speaks English, our phones show Spanish captions with "live · 1.4s behind", a Spanish question comes back "Possibly covered at 12:04" with the English line and score, then a chaos flag pushes lag up, Dash0 and Radar point at the translator, and the fallback flag brings it back in seconds.

**Wow moment:** demo beats 2 to 4 in the brief: live EN to ES captions with visible lag, a cross-language Q&A match, and one real ops incident fixed by a flag flip.

## Assumptions

- The brief's "one Python image, three processes" lives in `backend/` as package `roompass` (`python -m roompass api | pipeline | translator`), one image, three Deployments. The phone page and speaker view live in `web/` (static Vite build with Dash0 RUM), as set up in PR #4.
- TLS is already solved: the platform serves `https://the-mok-team.cnh.radarhq.io` to Service `app`. The speaker mic works on that URL.
- The brief's "Must ship" list is the hard requirements list (`brief/brief.md` §6).

## Phases

| # | Phase | Owner | Blocking? | Parallel with | Plan file | Target | Status |
|---|-------|-------|-----------|---------------|-----------|--------|--------|
| 00 | Monorepo scaffold: `web/` + `backend/`, two images, CI | Platform | Yes | | | | Done (PR #4) |
| 01 | Contract + seed data | All 3 | Yes | Nothing | `phase-01-contract.md` | H0, 20 min | |
| 02 | Pipeline lane: audio in, STT, translator, flags hooks | Pipeline | | 03, 04 | `phase-02-pipeline.md` | H1 to H3 | |
| 03 | App lane: api, Elasticsearch, Q&A match, phone page, speaker view | App | | 02, 04 | `phase-03-app.md` | H1 to H3 | |
| 04 | Platform lane: cluster, translator Deployment, flagd, Dash0, SLO, Gitar rules | Platform | | 02, 03 | `phase-04-platform.md` | H1 to H3 | |
| 05 | Wow moment hardened: thresholds, chaos rehearsal, real incident | All 3 | | 06 | `phase-05-wow.md` | H4 | |
| 06 | Stretch: catch me up | Pipeline | | 05 | `phase-06-catchup.md` | H4, only if 05 is on track | |
| 07 | Last mile: audit, personas, polish, docs, backup video | All 3 | | Split by owner | `phase-07-last-mile.md` | H4.5 to H5 | |
| 08 | Stretch: question themes | Platform (Miguel) | | 06 | `phase-08-question-themes.md` | H4, after 06 and only if 05 is on track | |

### Sync points (all three lanes meet, nobody moves on until it works)

| When | Done means |
|------|------------|
| H1 | English captions from OpenAI realtime reach a phone through the cluster. OTel in Dash0. STT gate: stay on OpenAI. |
| H2 | EN + ES captions on a phone from the public HTTPS URL. Test talk pre-loaded in the demo room. |
| H3 | Lag on screen, SLO in Dash0, Spanish question matches English captions, speaker view with opt-in. |
| H5 | Feature freeze. |

## Parallel work: encouraged

After phase 01, the three lanes run at the same time and should not wait on each other.

- **One lane, one folder set, one branch.** Pipeline: `backend/roompass/pipeline/`, `backend/roompass/translator/`. App: `backend/roompass/api/`, `web/`. Platform: `deploy/`, `.github/`, `.gitar/`, flagd config. Shared models in `backend/roompass/contract.py` and `web/src/api/contract.ts` are frozen after 01.
- **Build against the contract, not each other.** Each lane gets a fake for what it consumes:
  - App builds the phone page against a replay of the seeded segments over SSE, and the api against seeded Elasticsearch segments.
  - Pipeline tests the translator on fixture text, and the pipeline on the recorded 3-minute test talk.
  - Platform deploys the current images and placeholder processes until the real ones land.
- **Split inside a lane too (subagents, AGT-03).** These pairs share no files:
  - App: api + Elasticsearch / phone page + speaker view
  - Pipeline: STT / translator
  - Platform: manifests + flagd / Dash0 dashboards + SLO / Gitar review rules
- **Phases 05 and 06 run side by side.** Thresholds (App), chaos rehearsal (Platform) and catch me up (Pipeline) don't touch the same files.
- **Phase 07 splits by owner.** Each person writes their own `docs/tools/<tool>.md`. App polishes the phone page while Pipeline records the backup video and Platform runs the audit.

## Parallel work: not allowed

- **Phase 01.** Nobody builds until all 3 agree on the contract.
- **Contract changes after 01** are "ask first" (CT-05): announce to all three, one PR, everyone rebases.
- **Merges to `main` go one at a time.** Each merge deploys and CI adds a `deploy: <sha>` commit. Wait for it, `git pull --rebase`, then the next PR merges. Skipping this caused the conflict on PR #4.
- **Only Platform edits `deploy/`.** Other lanes ask Platform for a new Deployment, env var or Secret.
- **Elasticsearch mappings** are set in 01. A mapping change needs a reindex, so it is ask first.

## Requirements

Copied verbatim from the brief's "Must ship".

1. **Live captions** in EN and ES, with the lag on screen ("live · 1.4s behind").
2. **Typed Q&A with a soft match.** "Possibly covered at 12:04" plus the caption line, match score and a **Still ask** button. Works across languages: a Spanish question matches English captions. Phones show the top questions, with a filter. Spanish questions show in English on the speaker view.
3. **Speaker link.** Start button, and press-and-hold 3s to stop so a misclick never ends the talk. Questions sorted by votes. One opt-in switch for saving the transcript.
4. **Accessible app.** Font size, high contrast, screen reader labels, one-handed use, and a "machine captions, may contain errors" label.

**Never cut:** captions with lag, Q&A match, the ops story.

**Rule for AI:** AI transcribes and translates. It never decides what is true. Catch-up bullets must cite existing segment IDs, or code drops them. "Possibly covered" uses Elasticsearch search, no generation.

## Cut on purpose

- **From the brief:** follow-a-talk, end-of-talk summary, EN/ES question merge, edge mode, join-code rotation, TTL deletion, chatbot, more than 2 languages, accounts, notifications, schedules, sign language, recordings. None of them is on the demo path.
- **Moonshine self-hosted STT:** no judging line rewards it. Only if captions already work end to end at H1.
- **Catch me up:** stretch, first in the cut order if late.
- **Question filter:** third in the cut order.
- **Tests beyond two:** only the captions-path latency check and the citation validator (if catch-up ships), both enforced by Gitar rules.
- **Judges scanning the QR as part of the demo:** bonus only. 12 judges typing takes 60+ seconds, so the demo runs on our phones.
- **The placeholder `web/` hello page and `/api/health`:** replaced by the real phone page and api in 03.

**Cut order if late:** question themes, then catch me up, then the Moonshine swap, then the question filter.
