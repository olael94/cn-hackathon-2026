# General Plan

**Source:** `brief/brief.md` (cut-down) and `CONTRACT.md`. `CONTRACT.md` wins wherever they disagree.

**Demo path (one sentence):** Miguel speaks English, our phones show Spanish captions with "live · 6.2s behind", a Spanish question comes back "Possibly covered at 12:04" with the English line and score, then Dash0 shows that caption's trace and the lag SLO, and we tell the real incident from today.

**Wow moment:** demo beats 2 to 4 in the brief: live EN to ES captions with visible lag, a cross-language Q&A match, and one real incident found with Dash0 or Radar and fixed through a PR.

## Assumptions

- One backend process: `python -m roompass api` runs the api, the audio pipeline and the SSE fan-out together, 1 replica, `strategy: Recreate`. The `pipeline` and `translator` entries in `__main__.py` stay unused.
- The phone page and speaker view live in `web/` (static Vite build with Dash0 RUM), as set up in PR #4.
- TLS is already solved: the platform serves `https://the-mok-team.cnh.radarhq.io` to Service `app`. The speaker mic works on that URL.
- Shapes are JSON Schema in `schema/`, generated into both sides by `scripts/gen-types.sh`.

## Phases

| # | Phase | Owner | Blocking? | Parallel with | Target | Status |
|---|-------|-------|-----------|---------------|--------|--------|
| 00 | Monorepo scaffold: `web/` + `backend/`, two images, CI | Platform | Yes | | | Done (PR #4) |
| 01 | Contract: `CONTRACT.md`, Gitar rules, schemas + generated types | All 3 | Yes | Nothing | 3:15 PM | In progress (PR #6 merged) |
| 02 | Backend lane: audio upload, OpenAI transcription + translation, Elasticsearch, SSE, Q&A check, catch-up | Oliver | | 03, 04 | 3:15 to 4:30 PM | |
| 03 | Web lane: phone page, speaker view, accessibility | Frontend | | 02, 04 | 3:15 to 4:30 PM | |
| 04 | Platform lane: Secrets, Dash0 traces + RUM + lag SLO, Radar audit, real incident, PR check workflow | Miguel | | 02, 03 | 3:15 to 4:30 PM | |
| 05 | Stretch: question themes (`backend/roompass/themes/`) | Miguel | | 02, 03 | 4:00 to 4:30 PM, only if captions and Q&A work | |
| 06 | Freeze, rehearse, backup video, README, submit | All 3 | | Split by owner | 4:45 to 5:30 PM | |

### Sync points (all three lanes meet, nobody moves on until it works)

| When | Done means |
|------|------------|
| 3:15 PM | Schemas merged, everyone on the new `main`. OpenAI key and Elastic Cloud project work from the cluster. |
| 3:45 PM | Someone speaks, and a phone on the public URL shows EN + ES captions. Trace visible in Dash0. |
| 4:30 PM | Lag on screen, SLO in Dash0, a Spanish question matches English captions, speaker view shows questions. Test talk pre-loaded. |
| 4:45 PM | **Feature freeze.** |
| 5:30 PM | Submitted. |

## Parallel work: encouraged

- **One lane, one folder set, one branch.** Backend: `backend/roompass/` (except `generated/`, `contract.py` and `themes/`). Themes: `backend/roompass/themes/`. Web: `web/src/` (except `types/generated/`). Platform: `deploy/`, `.github/`, `.gitar/`, `docs/tools/`.
- **Build against the contract, not each other.**
  - Web builds against a fake SSE stream that replays the seeded segments from `schema/examples/`.
  - Backend tests on the recorded 3-minute test talk with `curl`.
  - Platform deploys the current images until the real ones land.

## Parallel work: not allowed

- **Contract changes after 01** are "ask first": announce to all three, one PR, everyone rebases.
- **Merges to `main` go one at a time.** Each merge deploys and CI adds a `deploy: <sha>` commit. Wait for it, `git pull --rebase`, then the next PR merges.
- **Only Platform edits `deploy/`.** Other lanes ask Platform for a new env var or Secret.
- **Elasticsearch mappings** follow `CONTRACT.md`. A mapping change needs a reindex, so it is ask first.

## Requirements

The [two-phone rehearsal](phase-03-qa-intent.md) exercises related questions, group ranking and the speaker brief.

Copied from the brief's "Must ship".

1. **Live captions** in EN and ES, with the lag on screen ("live · 6.2s behind").
2. **Typed Q&A with a soft match.** "Possibly covered at 12:04" plus the caption line, match score and a **Still ask** button. Works across languages: a Spanish question matches English captions. Phones show the top questions. Spanish questions show in English on the speaker view.
3. **Speaker link.** Start button, and press-and-hold 3s to stop so a misclick never ends the talk. Questions sorted by votes.
4. **Accessible app.** Font size, high contrast, screen reader labels, one-handed use, and a "machine captions, may contain errors" label.

**Never cut:** captions with lag, Q&A match, the Dash0 and Radar story.

**Rule for AI:** AI transcribes and translates. It never decides what is true. Catch-up bullets must cite existing segment IDs, or code drops them. "Possibly covered" uses Elasticsearch search, no generation.

## Cut on purpose

- **From the full brief:** Redis Streams, flagd and the chaos flag, OPUS-MT, Moonshine, WebSocket audio, 15 s passages, transcript opt-in switch, follow-a-talk, end-of-talk summary, EN/ES question merge, edge mode, join-code rotation, TTL deletion. They go on the "what's next" slide.
- **Tests beyond two:** only the citation validator and a quick captions-path check.
- **Judges scanning the QR as part of the demo:** bonus only. The demo runs on our phones.

**Cut order if late:** question themes, then catch me up, then the question filter, then vote counts. Never captions, the Q&A match or the ops story.
