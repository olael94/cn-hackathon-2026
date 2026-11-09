# Gitar

Gitar reviews every PR against the rules in `.gitar/review/`. Each feature lands through a PR, never straight to `main`.

## Findings by PR

PRs 1 to 3, #10 (flagd and translator manifests) and #18 (Radar audit fixes, `Rules 3/3 met`) had no findings. PR 1 was the smoke test that confirmed Gitar reviews this repo.

| PR | Type | Finding | Outcome |
| --- | --- | --- | --- |
| #4 | Bug | Merge conflict set the `web` image tag to the old Node starter image, so Argo CD would roll out the wrong build | Taken. Fixed via Gitar (tag set to a `web-pending` placeholder that only CI rewrites) |
| #4 | Quality | Health fetch used `useEffect` instead of TanStack Query (VT-02) | Taken. Fixed by @melizalde-ds in `822a384` (PR #5) |
| #4 | Quality | `Health` shape copied by hand in pydantic and zod (CT-01/CT-02) | Taken. Now generated from `schema/health.json` |
| #5 | Quality | Same TanStack Query finding, raised again | Taken. Fixed by @melizalde-ds in `822a384` |
| #5 | Quality | Design spec said to build static HTML served by FastAPI, but the repo is Vite React | Taken. Fixed by @melizalde-ds in `7ef2625` |
| #5 | Quality | Design doc used em dashes, which CLAUDE.md forbids | Taken. Fixed by @melizalde-ds in `7ef2625` |
| #5 | Bug | Hold-to-stop started a second timer on a repeat press | Taken. Fixed by @melizalde-ds in `7ef2625` |
| #5 | Bug | Token map drops `--danger`, so the SLO badge and hold-to-stop button lose their red | Open |
| #6 | Bug | Match `score` thresholds didn't match what Elasticsearch returns (RRF scores are about 0.01 to 0.03) | Taken. Fixed via Gitar |
| #6 | Edge case | Reconnect replay from Elasticsearch could skip segments not yet refreshed | Taken. Fixed via Gitar (replay from the in-memory buffer first) |
| #6 | Edge case | In-order processing stalled when a chunk never arrived | Taken. Closed in PR #6 |
| #6 | Edge case | RollingUpdate surge briefly ran 2 backend pods, splitting SSE | Taken. Fixed via Gitar |
| #7 | Quality | Documented nginx resolver fix fails on the short name `backend`; use the full Service name | Taken. radar.md and PR #11 use `backend.team-the-mok-team.svc.cluster.local` |
| #9 | Quality | Healthy lag example 6.2 s falls in the Degrading band (6 to 10 s) | Open |
| #8 | Quality | Phase 08 (question themes, a stretch) was scheduled H1 to H4 next to the must-have lanes, with no gate (HACK-03) | Taken. Fixed by @melizalde-ds in `d672345`: H4, after 06, only if 05 is on track |
| #8 | Edge case | Off-topic cutoff 0.5 equals cosine 0 under `(1 + cos) / 2`, so almost nothing would count as off topic | Taken. Fixed by @melizalde-ds in `d672345`: cutoff 0.65, tune on seeded questions |
| #11 | Bug | Image default `BACKEND_URL=http://backend` now 502s in cluster, because nginx's resolver ignores DNS search domains; any manifest without the override breaks | Open |
| #12 | Edge case | Badge stays on "Reconnecting" after a reconnect once all captions are shown | Taken. Closed in PR #12 |
| #12 | Bug | Speaker start, stop and reset break when localStorage is blocked | Taken. Closed in PR #12 |
| #13 | Quality | Themes endpoint status codes (`503`, empty set for an unknown talk) missing from CONTRACT.md | Taken. Fixed by @melizalde-ds in `5c53237`: both documented in CONTRACT.md |
| #13 | Quality | Label model name hardcoded in `backend/roompass/themes/labels.py` | Taken. Fixed by @melizalde-ds in `5c53237`: `THEMES_LABEL_MODEL` env var, default `gpt-5.4-mini` |
| #13 | Edge case | Capped neighbor search: off-topic or seed hits can push real neighbors out, so some themes never form | Taken. Fixed by @melizalde-ds in `5c53237`: search filtered to the on-topic question ids |
| #14 | Bug | `[1m]` rate windows can return no data with a 1-minute SignalControl aggregation, leaving panels empty and the lag alert silent | Taken. Fixed by @melizalde-ds in `8cb2d9a`: every window is `[2m]` |
| #15 | Quality | Radar budget row mixed scopes: memory requests 1856Mi above limits 1152Mi, which Kubernetes can't allow | Taken. Fixed by @melizalde-ds in this PR: namespace and cluster totals stated separately |
| #16 | Edge case | One-backend-pod rule skipped kustomize `replicas:` or `patches:` overrides in `deploy/kustomization.yaml` | Taken. Fixed by @melizalde-ds in `3c77b39`: trigger covers kustomization overrides |
| #17 | Bug | Chaos runbook said to flip the delay flag to 8000 ms, but flagd's `on` variant was 4000 ms, so lag would reach about 5.4 s and never cross the 10 s SLO line in the demo | Taken. Fixed by @melizalde-ds in `01425ef`: `on` raised to 10000 in `deploy/flagd.yaml` and the runbook names that variant |
| #19 | Bug | `load_state` race after a restart: phones reconnecting at once each built their own `TalkState`, and all but the last stopped getting captions with no error | Taken. Fixed in PR #19 before merge |
| #19 | Security | `/api/translate` proxy was open with no auth | Taken. Fixed in PR #19 before merge |
| #19 | Bug | A stale `arrived_at` entry made stopping a talk wait 5 s | Taken. Fixed in PR #19 before merge |
| #20 | Bug | Themes cache never refreshed, because nothing calls `note_question_change` yet, so the first `ThemeSet` stayed for the whole talk | Taken. Fixed by @melizalde-ds in `7c4f8c5`: rebuild when the cached set is older than 60 seconds |
| #20 | Quality | `.env.example` set `THEMES_LABEL_MODEL=gpt-5.4-mini`, a second copy of the code default | Taken. Fixed by @melizalde-ds in `7c4f8c5`: value left empty, and an empty value falls back to the default |
| #19 | Bug | After a pod restart, phones reconnecting at once each built their own talk state, so all but the last stopped getting captions with no error | Taken. Fixed via Gitar in `401ee01`: re-check after the Elasticsearch reads so every loader shares one state |
| #19 | Security | `POST /api/translate` was public with no token, an open proxy to our OpenAI key | Taken. Fixed via Gitar in `401ee01`: `X-Internal-Token` must match `TRANSLATOR_TOKEN` |
| #19 | Edge case | A retried or late audio chunk left a stale entry, so every stop waited the full 5 s and the chunk was still transcribed at OpenAI cost | Taken. Fixed via Gitar in `401ee01`: chunks below the next publish seq are ignored before any work |
| #19 | Quality | Contract sync rule: `TranslateRequest` and `TranslateResponse` lived only in `pipeline.py`, not in `contract.py` or `contract.ts` | Taken. Fixed by @melizalde-ds in `fix/translate-contract`: schemas in `schema/`, types generated for both sides |
| #21 | Bug | radar.md memory request total 704Mi contradicts the manifests (576Mi) | Open |
| #21 | Quality | `otel` Secret creation time differs between dash0.md (3:55 PM) and radar.md (3:49 PM) | Open |
| #21 | Quality | Unapplied `otel` Secret fix in dash0.md should have status `Open` | Open |
| #22 | Quality | Translate schema accepts any string for `source` and `target`, but CONTRACT.md allows only `en` or `es` | Open |
| #24 | Bug | No code sends `roompass.caption.late`, so the caption SLO and `CaptionsLate` alert get no data | Taken, with a different fix. Gitar suggested a phone `sendEvent`, but the phone still shows seeded lag. The backend now sets the lag on the `pipeline.publish` span, and the alert, SLO and panels count spans |
| #24 | Bug | `PipelineErrors` misses translate and index failures, because the caught exceptions never set span status ERROR | Taken. `translate()` and `index_quietly()` now set `StatusCode.ERROR` |
| #24 | Bug | Chaos panel groups by `roompass.chaos`, which no span sets | Taken in part. Panel now splits by `translator.fallback`, which the code sets. Nothing reads the chaos flag yet: Open |
| #27 | Quality | Probe and log findings from live Dash0 data had no entry in `docs/tools/dash0.md` (rule "Tool finding is logged" failed) | Taken. Two rows added under Tooling problems in `docs/tools/dash0.md` |
| #27 | Edge case | Error % panels per stage, service and route show "No data" instead of 0% when a group has no errors | Taken. All three use `or 0 * sum by (...)` to keep a 0 line per group |

## Rejected

None yet.

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:05 PM | Every PR (#8, #10, #11, #13, #14) shows `Rules: No rules evaluated`, although `.gitar/review/` has 6 files. Gitar treats `.gitar/review/` as review instructions (they work: findings quote HACK-03 and our contract rules). Rules are a separate feature: `.gitar/rules/*.md` with YAML frontmatter (`title`, `description`, `when`, `actions`), per https://docs.gitar.ai/features/rules.md. | PR #16 added 3 rules in `.gitar/rules/`. Gitar's review of #16 showed `Rules: 2/2 met`, the first PR with rules evaluated. |
| 2026-11-09, 3:05 PM | `Auto-apply is off` on every PR, so Gitar only comments and never commits a fix. The track asks for a fix Gitar applied. | Turn it on per PR with the comment `gitar auto-apply:on`. |
