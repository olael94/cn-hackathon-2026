# Gitar

Gitar reviews every PR against the rules in `.gitar/review/`. Each feature lands through a PR, never straight to `main`.

## Findings by PR

PRs 1 to 3 and #10 (flagd and translator manifests) had no findings. PR 1 was the smoke test that confirmed Gitar reviews this repo.

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
| #8 | Quality | Phase 08 (question themes, a stretch) was scheduled H1 to H4 next to the must-have lanes, with no gate (HACK-03) | Taken. Fixed by @melizalde-ds in `d672345`: H4, after 06, only if 05 is on track |
| #8 | Edge case | Off-topic cutoff 0.5 equals cosine 0 under `(1 + cos) / 2`, so almost nothing would count as off topic | Taken. Fixed by @melizalde-ds in `d672345`: cutoff 0.65, tune on seeded questions |
| #11 | Bug | Image default `BACKEND_URL=http://backend` now 502s in cluster, because nginx's resolver ignores DNS search domains; any manifest without the override breaks | Open |
| #13 | Quality | Themes endpoint status codes (`503`, empty set for an unknown talk) missing from CONTRACT.md | Open |
| #13 | Quality | Label model name hardcoded in `backend/roompass/themes/labels.py` | Open |
| #13 | Edge case | Capped neighbor search: off-topic or seed hits can push real neighbors out, so some themes never form | Open |
| #14 | Bug | `[1m]` rate windows can return no data with a 1-minute SignalControl aggregation, leaving panels empty and the lag alert silent | Open |

## Rejected

None yet.

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:05 PM | Every PR (#8, #10, #11, #13, #14) shows `Rules: No rules evaluated`, although `.gitar/review/` has 6 files. Gitar treats `.gitar/review/` as review instructions (they work: findings quote HACK-03 and our contract rules). Rules are a separate feature: `.gitar/rules/*.md` with YAML frontmatter (`title`, `description`, `when`, `actions`), per https://docs.gitar.ai/features/rules.md. | Adding `.gitar/rules/` in a separate PR. |
| 2026-11-09, 3:05 PM | `Auto-apply is off` on every PR, so Gitar only comments and never commits a fix. The track asks for a fix Gitar applied. | Turn it on per PR with the comment `gitar auto-apply:on`. |
