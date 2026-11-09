---
title: "Backend runs one pod"
description: "Keep backend at 1 replica with Recreate while SSE fan-out is in memory"
when: "PRs that change deploy/backend.yaml or add an autoscaler, Rollout or PodDisruptionBudget for backend"
actions: "Request changes and explain that phones on the second pod would miss captions"
type: check
---

# Backend runs one pod

Live captions fan out from memory inside the backend pod. With two pods, a phone connected to one misses segments produced on the other.

Pass when Deployment `backend` keeps `replicas: 1` and `strategy.type: Recreate`, and nothing scales it above 1.

Fail when the PR raises replicas, switches to `RollingUpdate`, or adds an HPA or canary for `backend`, unless the same PR adds a shared pub/sub and updates `CONTRACT.md` and `.gitar/review/kubernetes.md` to match.
