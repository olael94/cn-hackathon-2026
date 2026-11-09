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

## Checks (cluster audit)

`get_cluster_audit` on `team-the-mok-team`: 7 findings, all medium, 0 high. Screenshot: [`../checks-before.webp`](../checks-before.webp).

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
| 2026-11-09, 3:55 PM | Every rollout leaves Warning events `Unhealthy` (readiness and liveness `connection refused`) while new pods start. | Logs show uvicorn ready about 2 s after start and no restarts, so it is startup noise. Not changed for the demo. |
| 2026-11-09, 4:00 PM | Radar's node gauges looked busy (one node at 64% CPU, 78% memory). `top_resources` showed `team-the-mok-team` uses about 5m CPU and 170Mi in total, against 450m / 704Mi requested. | The nodes are the shared host, so trimming our Deployments would not relieve them. Left requests as they are until the captions pipeline (PR #19) runs under load, then check `get_rightsizing`. |
