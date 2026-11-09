# Gitar

Gitar reviews every PR against the rules in `.gitar/review/`. Each feature lands through a PR, never straight to `main`.

## Findings by PR

PRs 1 to 3 had no findings. PR 1 was the smoke test that confirmed Gitar reviews this repo.

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

## Rejected

None yet.
