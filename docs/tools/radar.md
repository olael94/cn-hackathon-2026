# Radar

The app runs on Radar's hosted vcluster `the-mok-team`, namespace `team-the-mok-team`. We read and operate it through Radar Cloud's MCP server (`radar-cloud`). Deploys go through Argo CD: merge to `main`, CI builds the images, Argo CD syncs.

## Incidents found with Radar

### 2026-11-09: web pod restarted once on rollout

**What we saw.** After the 2:43 PM MT rollout of `web-0a547db`, Radar showed pod `app-7ff49f4c97-n7slg` with 1 restart, last terminated reason `Error`. The app stayed up: Argo CD `Synced` and `Healthy` at `d248ebe`, 4 of 4 pods ready, `/` and `/api/health` both returned 200.

**Seen again.** The 2:55 PM MT rollout of `web-257e5d7` (PR #6 merge, deploy commit `75332d9`) restarted every new `app` pod once with the same log line. Radar raised two warnings on Deployment `app`, including `LivenessProbeFailed`. Fix: PR #11.

**How we found the cause.** `diagnose` on the pod returned the previous container's logs:

```
nginx: [emerg] host not found in upstream "backend" in /etc/nginx/conf.d/default.conf:9
```

The pod's events showed readiness and liveness probes refused for the few seconds before the restart.

**Cause.** `web/nginx.conf.template` uses `proxy_pass ${BACKEND_URL};` with a fixed hostname. nginx looks up `backend` once at startup and exits if cluster DNS doesn't answer in time. The second start found it and has served fine since.

**Status.** Fixed on branch `fix/nginx-dns-resolve`: a `resolver` line plus a variable in `proxy_pass`, so nginx looks up `backend` per request instead of once at startup. `BACKEND_URL` is now the full Service name, because nginx's resolver ignores DNS search domains. New `app` pods should show 0 restarts.

### 2026-11-09: translator rejected every call after PR #19

**What we saw.** After PR #19 (live captions) deployed at 4:04 PM MT, `diagnose` on Deployment `backend` returned one log line: `translator unavailable, local fallback: HTTPStatusError`. The pods were healthy and every deploy run had passed, so nothing looked broken from the outside.

**How we found the cause.** `get_workload_logs` on `translator` with `grep` showed `POST /api/translate HTTP/1.1" 401 Unauthorized`. `get_changes` showed PR #19 had added env `TRANSLATOR_TOKEN` from `secretKeyRef: app-credentials/translator-token` (optional) to both Deployments. That Secret did not exist, so both sides had an empty token, and `pipeline.py` rejects every call when the expected token is empty.

**Impact.** Spanish captions still worked through the local fallback, but the translator pod never did any work, so the chaos flag on it would have shown nothing in the demo.

**Fix.** Created Secret `app-credentials` with a random `translator-token` in the Radar UI (outside git), then restarted both Deployments with `manage_workload`. A test talk at 4:12 PM MT returned EN and ES captions, and the translator logged `POST /api/translate HTTP/1.1" 200 OK` with no fallback warning in the backend.

### 2026-11-09: probe and scheduling warnings on every rollout

**What we saw.** After the 4:22 PM MT rollout of `c201d80`, the Radar UI showed `Liveness probe failed: ... connect: connection refused` on pods `backend-6cbc755b7c-wx6h5` and `translator-6cfd8bd5d8-q5sqk`.

**How we found the cause.** `diagnose` on Deployment `backend`: the container started at 4:22:09, the probe failed once at 4:22:12, and `/healthz` returned 200 from then on. 0 restarts, no previous container logs.

**Cause.** The liveness probe starts with no delay. The backend creates the Elasticsearch indices before it listens (`backend/roompass/api.py`), so a slow Elasticsearch could keep it closed past the liveness limit (3 failures, 10 s apart) and get it restarted in a loop.

**Fix.** PR #25: a startup probe on `backend` (`/healthz`, every 2 s, up to 30 tries), so it gets up to 60 s to start. The translator does not wait on Elasticsearch, so it keeps the default.

**Checked again at 4:40 PM MT.** After 8 deploys from 3:37 to 4:39 PM MT (last `1ed4c9e`, sync `6bf74cc`), the Radar UI showed Application `app` `Healthy` with four warnings: startup and readiness probes refused on `backend` and `translator`, and `FailedScheduling` on `app-5997dd6b79-m4lzz` and `translator-64cbb95694-z7j9r` ("0/26 nodes are available: ... 21 node(s) were unschedulable").

- `issues` on `team-the-mok-team` returned 0, and `list_resources` showed all 5 pods `1/1` on `1ed4c9e`.
- `diagnose` on `backend`: 0 restarts in the last hour. Live requests passed: audio upload, OpenAI transcription, translator `200 OK`, Elasticsearch writes.
- `get_events` on `app-5997dd6b79-m4lzz`: nominated to a new host node claim (`cnh-xxrqf`) and scheduled 8 s after the last `FailedScheduling`. No `exceeded quota` event, so the shared host nodes were full, not our budget.
- AI investigation `chat_MzMEPK79-_XVKBYY` on Application `app`, done at 4:41 PM MT: "The Argo CD Application app is synced and healthy, with its latest deployment applied successfully; no action needed." Confidence 0.88. It also flagged the CoreDNS rewrite rule that every team's cluster has.

**Status.** Startup noise from frequent rollouts. No fix needed beyond PR #25.

## Checks (cluster audit)

`get_cluster_audit` on `team-the-mok-team`: 7 findings, all medium, 0 high. Screenshot: [`radar-checks-before.webp`](radar-checks-before.webp).

| Resource | Check | Decision |
| --- | --- | --- |
| `backend` | Only 1 replica | Skip. On purpose: SSE fan-out lives in memory, so a second pod would miss segments (`deploy/backend.yaml`, `.gitar/review/kubernetes.md`, `.gitar/rules/backend-single-replica.md`). Needs shared pub/sub first. |
| `app` | 2 replicas, no PodDisruptionBudget | Fixed in PR #18 (live since 3:35 PM MT): `deploy/pdb.yaml`, `minAvailable: 1`. |
| `app` | 2 replicas, no topology spread | Fixed in PR #18 (live since 3:35 PM MT): spread by `kubernetes.io/hostname`, `ScheduleAnyway` so a full node never blocks scheduling. |
| `app`, `backend` | Service account token auto-mounted | Fixed in PR #18 (live since 3:35 PM MT): `automountServiceAccountToken: false`. Neither pod calls the Kubernetes API. |
| `app`, `backend` | Root filesystem not read-only | Skip for the demo. nginx writes its config at startup and Python writes to `/tmp`, so both need `emptyDir` mounts; one wrong path crashes the pod before the demo. |

### After (2026-11-09, 3:30 PM MT)

`get_cluster_audit` on `team-the-mok-team`: 12 findings, all medium, 0 high. The 5 new ones come from `flagd` and `translator`, added today in PR #10.

| Resource | Check | Decision |
| --- | --- | --- |
| `flagd`, `translator` | Service account token auto-mounted | Fixed in PR #18 (live since 3:35 PM MT). flagd reads its flags from a file, not the Kubernetes API. |
| `translator` | Root filesystem not read-only | Skip for the demo, same reason as `backend` (same image). |
| `translator` | Only 1 replica | Skip. It is the chaos target in the demo, and one pod keeps the story readable in Radar and Dash0. Fits the budget either way. |
| `flagd` | Only 1 replica | Skip. Flags are a demo control, and a restart loads the same file from the ConfigMap. |

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:00 PM | `top_resources` for the budget check (PR #10): the pre-installed pods' CPU limits already add up to 5750m, over the documented 4 CPU limit budget, so the quota probably doesn't count them. Not confirmed. | Treated our own Deployments' totals as the budget. After PR #10, `team-the-mok-team` requests 450m CPU / 576Mi and limits 2200m / 1152Mi (from `deploy/*.yaml`). The whole cluster, pre-installed pods included, requests 980m / 1856Mi. |
| 2026-11-09, 3:35 PM | During the PR #17 rollout, Radar showed a Warning `FailedCreatePodSandBox`: `aws-cni` failed to assign an IP address to a new pod. | Host network, not ours to fix. The pod retried on its own and came up; Argo CD stayed `Healthy`. |
| 2026-11-09, 3:37 PM | After the PR #17 merge, Argo CD synced `9babe01` but not the CI deploy commit `f0f59c1`, so the live images were one build behind. `manage_gitops` sync pinned to `f0f59c1` was refused: "auto-sync is enabled with target revision main". | Ran `manage_gitops` sync with no revision. Argo CD moved to `f0f59c1` and the new images; `/api/health` showed `9babe01`. |
| 2026-11-09, 3:49 PM | Creating the `openai`, `elastic` and `otel` Secrets: a dry run of `apply_resource` on a Secret echoes its data back (base64) in the tool result, so an agent would see the keys. | Generated the Secret YAML from `.env` with a local script that prints key names only, and the person applied it in the Radar UI. Restarted `backend` and `translator` with `manage_workload`; both rolled out 1/1. |
| 2026-11-09, 3:55 PM | Every rollout leaves Warning events `Unhealthy` (readiness and liveness `connection refused`) while new pods start. | Logs show uvicorn ready about 2 s after start and no restarts, so it is startup noise. Changed later for `backend` only: startup probe in PR #25 (see the incident above). |
| 2026-11-09, 4:00 PM | Radar's node gauges looked busy (one node at 64% CPU, 78% memory). `top_resources` showed `team-the-mok-team` uses about 5m CPU and 170Mi in total, against 450m / 704Mi requested. | The nodes are the shared host, so trimming our Deployments would not relieve them. Left requests as they are until the captions pipeline (PR #19) runs under load, then check `get_rightsizing`. |
