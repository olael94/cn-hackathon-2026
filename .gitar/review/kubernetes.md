# Kubernetes and Deploy (Shared Hackathon Cluster)

Pushing to `main` deploys through Argo CD to namespace `team-the-mok-team`. A bad manifest takes the live demo down.

- Every container sets CPU and memory requests and limits. The whole cluster budget is 2 CPU and 4 GiB of requests, 4 CPU and 8 GiB of limits, 4 PVCs. Flag a PR that would push the total over, and remember a canary briefly runs extra pods.
- The `backend` Deployment must run `replicas: 1` while SSE fan-out is in memory. With 2 replicas, a phone connected to one pod misses segments produced on the other. Flag any increase unless the PR also adds a shared pub/sub.
- Keep Service `app` on port 80 to container port 8080. The platform routes the public URL to it. Do not rename it or change its type.
- No privileged pods, `hostPath`, `hostNetwork` or `hostPID`. The host refuses them and the pod stays `Pending`.
- Do not hand-edit `newName` or `newTag` in `deploy/kustomization.yaml`. The GitHub Action owns them.
- Secrets reach pods through `secretRef` to Secrets kept outside git. Flag any `kind: Secret` with real data committed to `deploy/`.
- nginx in `web/` must not buffer the SSE stream: the `/api/` location needs `proxy_buffering off` and a `proxy_read_timeout` longer than the 15 s ping. Flag changes that remove either.
- Do not touch the pre-installed platform: Argo CD, Argo Rollouts, Prometheus, CloudNativePG, Radar.
