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

## After

Recorded 2026-11-09 5:00 PM MST, Argo CD on `dd2c046` (PR #27).

**Critical:** 0 · **High:** 0 · **Medium:** 6 · **Low:** 0

- Fixed in PR #18: `automountServiceAccountToken`, `missingPDB` and `missingTopologySpread` on `app`.
- Left, with reasons in `docs/tools/radar.md`: `readOnlyRootFs` on `app`, `backend`, `translator` (nginx and Python write at startup; one wrong `emptyDir` path crashes the pod before the demo) and `singleReplica` on `backend` (SSE fan-out is in memory), `translator` (chaos target), `flagd` (demo control).
- New since the morning: `backend`, `translator` and `flagd` did not exist at 12:32. Checks peaked at 12 findings at 3:30 PM after PR #10 added them.

## The story

- **What we built:** RoomPass gives every conference room live English and Spanish captions and Q&A that says if your question was already answered, for deaf and hard-of-hearing attendees and second-language listeners (`README.md`).
- **How we shipped:** every change merged to `main` through a Gitar-reviewed PR (#3 to #27), CI built the images, and Argo CD synced them: 21 deploy commits today, the last `dd2c046` live at 4:53 PM (`get_changes`).
- **What broke and what Radar showed:** after PR #19, `get_workload_logs` on `translator` showed `401 Unauthorized`, and `get_changes` showed the new `TRANSLATOR_TOKEN` pointed at a Secret that did not exist; we created it and restarted both Deployments, and the translator answered `200 OK` at 4:12 PM.
- **The investigation:** after 8 deploys in an hour left probe and `FailedScheduling` warnings, AI investigation `chat_MzMEPK79-_XVKBYY` on Application `app` (4:41 PM, confidence 0.88) found it synced and healthy with no action needed, which matched `issues` returning 0, so we kept the PR #25 startup probe and changed nothing else.
- **Checks before and after:** 4 medium findings at 12:32 PM, 12 at 3:30 PM after adding three Deployments, 6 at 5:00 PM: PR #18 fixed the PodDisruptionBudget, topology spread and token findings, and the 6 left are skipped on purpose.

## Screenshots to take

- Timeline: https://app.radarhq.io/c/wlL3zt_-jyc/timeline
- Application `app`: https://app.radarhq.io/c/wlL3zt_-jyc/resources/applications?resource=team-the-mok-team/app&apiGroup=argoproj.io
- All Checks: https://app.radarhq.io/checks?scope=wlL3zt_-jyc
- Team Checks (next to `docs/tools/radar-checks-before.webp`): https://app.radarhq.io/checks?scope=wlL3zt_-jyc&namespace=team-the-mok-team
- Investigation `chat_MzMEPK79-_XVKBYY`: https://app.radarhq.io/c/wlL3zt_-jyc/investigations
