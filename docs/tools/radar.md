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
| `backend` | Only 1 replica | Skip. On purpose: SSE fan-out lives in memory, so a second pod would miss segments (`deploy/backend.yaml`, `.gitar/review/kubernetes.md`). Needs shared pub/sub first. |
| `app` | 2 replicas, no PodDisruptionBudget | To decide |
| `app` | 2 replicas, no topology spread | To decide |
| `app`, `backend` | Service account token auto-mounted | To decide. Neither pod calls the Kubernetes API. |
| `app`, `backend` | Root filesystem not read-only | To decide. nginx writes its config at startup, so it would need an `emptyDir`. |

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:00 PM | `top_resources` for the budget check (PR #10): the pre-installed pods' CPU limits already add up to 5750m, over the documented 4 CPU limit budget, so the quota probably doesn't count them. Not confirmed. | Treated our own Deployments' totals as the budget. After PR #10, `team-the-mok-team` requests 450m CPU / 576Mi and limits 2200m / 1152Mi (from `deploy/*.yaml`). The whole cluster, pre-installed pods included, requests 980m / 1856Mi. |
