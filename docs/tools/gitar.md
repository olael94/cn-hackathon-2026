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
| #13 | Quality | Themes endpoint status codes (`503`, empty set for an unknown talk) missing from CONTRACT.md | Taken. Fixed by @melizalde-ds in `5c53237`: both documented in CONTRACT.md |
| #13 | Quality | Label model name hardcoded in `backend/roompass/themes/labels.py` | Taken. Fixed by @melizalde-ds in `5c53237`: `THEMES_LABEL_MODEL` env var, default `gpt-5.4-mini` |
| #13 | Edge case | Capped neighbor search: off-topic or seed hits can push real neighbors out, so some themes never form | Taken. Fixed by @melizalde-ds in `5c53237`: search filtered to the on-topic question ids |
| #14 | Bug | `[1m]` rate windows can return no data with a 1-minute SignalControl aggregation, leaving panels empty and the lag alert silent | Taken. Fixed by @melizalde-ds in `8cb2d9a`: every window is `[2m]` |
| #15 | Quality | Radar budget row mixed scopes: memory requests 1856Mi above limits 1152Mi, which Kubernetes can't allow | Taken. Fixed by @melizalde-ds in this PR: namespace and cluster totals stated separately |
| #16 | Edge case | One-backend-pod rule skipped kustomize `replicas:` or `patches:` overrides in `deploy/kustomization.yaml` | Taken. Fixed by @melizalde-ds in `3c77b39`: trigger covers kustomization overrides |
| #20 | Bug | Themes cache never refreshed, because nothing calls `note_question_change` yet, so the first `ThemeSet` stayed for the whole talk | Taken. Fixed by @melizalde-ds in `7c4f8c5`: rebuild when the cached set is older than 60 seconds |
| #20 | Quality | `.env.example` set `THEMES_LABEL_MODEL=gpt-5.4-mini`, a second copy of the code default | Taken. Fixed by @melizalde-ds in `7c4f8c5`: value left empty, and an empty value falls back to the default |
| #24 | Bug | No code sends `roompass.caption.late`, so the caption SLO and `CaptionsLate` alert get no data | Taken, with a different fix. Gitar suggested a phone `sendEvent`, but the phone still shows seeded lag. The backend now sets the lag on the `pipeline.publish` span, and the alert, SLO and panels count spans |
| #24 | Bug | `PipelineErrors` misses translate and index failures, because the caught exceptions never set span status ERROR | Taken. `translate()` and `index_quietly()` now set `StatusCode.ERROR` |
| #24 | Bug | Chaos panel groups by `roompass.chaos`, which no span sets | Taken in part. Panel now splits by `translator.fallback`, which the code sets. Nothing reads the chaos flag yet: Open |

## Rejected

None yet.

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:05 PM | Every PR (#8, #10, #11, #13, #14) shows `Rules: No rules evaluated`, although `.gitar/review/` has 6 files. Gitar treats `.gitar/review/` as review instructions (they work: findings quote HACK-03 and our contract rules). Rules are a separate feature: `.gitar/rules/*.md` with YAML frontmatter (`title`, `description`, `when`, `actions`), per https://docs.gitar.ai/features/rules.md. | PR #16 added 3 rules in `.gitar/rules/`. Gitar's review of #16 showed `Rules: 2/2 met`, the first PR with rules evaluated. |
| 2026-11-09, 3:05 PM | `Auto-apply is off` on every PR, so Gitar only comments and never commits a fix. The track asks for a fix Gitar applied. | Turn it on per PR with the comment `gitar auto-apply:on`. |
