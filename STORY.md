# the-mok-team: the day in Radar

## Before

Recorded 2026-11-09 12:32 MST, right after the first GitOps sync (Argo CD revision `621bfab`, image `52a55c6`).

Radar Checks for namespace `team-the-mok-team`: https://app.radarhq.io/checks?scope=wlL3zt_-jyc&namespace=team-the-mok-team

**Critical:** 0 · **High:** 0 · **Medium:** 4 · **Low:** 0

Medium:
- Security / `automountServiceAccountToken`: Deployment `app` (service account token auto-mounted)
- Security / `readOnlyRootFs`: Deployment `app`, container `app` (no read-only root filesystem)
- Reliability / `missingPDB`: Deployment `app` (2 replicas, no PodDisruptionBudget)
- Reliability / `missingTopologySpread`: Deployment `app` (2 replicas, no topology spread constraints)
