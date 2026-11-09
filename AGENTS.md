# Notes for your coding agent

This repo deploys to this team's own Kubernetes cluster at the Cloud Native Hackathon: a virtual cluster (vcluster) that Radar Cloud lists as **`the-mok-team`**, where the team is cluster-admin. The app runs in namespace `team-the-mok-team`. Use Radar Cloud's MCP server (`radar-cloud`) for everything you observe or change on the cluster. Read each tool's schema; don't invent parameters.

**Pass `cluster` on every Radar call.** The organization has about 40 team clusters plus `cnh`, the platform's cluster, where teams have no access. Call `list_clusters` once per session, take the `id` of the entry whose `name` is exactly `the-mok-team`, and pass that id as `cluster` on every other Radar tool call. With this many clusters the tools can't pick a default. The person only has access to this team's cluster; never call a tool against `cnh` or another team's cluster. Pass `namespace: team-the-mok-team` wherever a tool takes it, unless you mean another namespace in this cluster.

Deploys are GitOps: change the repo, push to `main`, and Argo CD syncs the namespace. Pushing to `main` is how you deploy here, so when the person asks you to ship, fix, add or change something, that's the go-ahead to commit and push it; ask first only about changes they didn't ask for. Argo CD runs inside this cluster (namespace `argocd`) with no web UI; you drive it with `manage_gitops`. Your Argo CD Application `app` lives in `team-the-mok-team`, not in `argocd`: pass that namespace when you look it up, sync it or `diagnose` it. Don't apply or patch app manifests on the cluster. Argo CD's self-heal puts the repo's version back. Apply `argocd/application.yaml` once to start the sync. One-off Jobs and credential Secrets deliberately kept outside git can also be created directly when Argo CD does not own them; follow `examples/agent-workflows/README.md`.

**Run shell commands one at a time, in plain form.** Claude Code asks the person to approve any command with `$(…)`, `$?` or shell variables, so avoid them: run `git rev-parse HEAD` on its own and use the SHA it prints in the next command; `gh run watch <id> --exit-status` already fails when the run fails, so don't echo `$?`; run `git pull --rebase` as its own command. Write and edit files with your file tools, not heredocs.

## When to do what

- **The person asks to get set up, or what to do first.** Follow the `get-started` skill. It checks first, and asks once before it pushes and deploys.
- **Before anything else: is this repo set up?** If the cluster name in bold at the top of this file is still a placeholder (capital letters between double underscores) rather than a team name, `./scripts/setup.sh` hasn't run in this clone. Use the team name the person gave you, or ask for it, and run `./scripts/setup.sh <team>` (it only edits files in this clone; pushing comes later, with the `ship` skill), then read this file again. A missing team name is not an invite problem.
- **First cluster access in a session.** Call `list_clusters`, find `the-mok-team`, and read the workloads in `team-the-mok-team` with its id. If you have no Radar tools, or they need authentication, the person connects and signs in (the `get-started` skill has the steps). If no cluster is named `the-mok-team`, the person hasn't accepted the Radar Cloud invite, or picked a different organization when connecting (no `cnh` in the list means another organization). Ask them to sign in again and pick **Cloud Native Hackathon** under "Organization access". If it's there but your calls to it are refused within a few minutes of sign-up, that's normal: access lands a minute or two after signing up. Wait a minute and retry, for up to about 5 minutes. After that, check that the person signed in with an email the team listed when it joined. If it's disconnected, or nothing here helps, ask an organizer at the Radar table. Don't go on until you can read the namespace.
- **After every push.** Follow the `ship` skill’s build-trigger rules. For a build-triggering push, confirm the `build-and-deploy` GitHub Action for the pushed application commit succeeded and produced its `deploy: <sha> [skip ci]` commit, then `git pull --rebase` it so your next push isn't rejected. Sync or inspect the Argo CD Application through Radar, confirm the live workload uses that build’s image, then wait for the rollout. A healthy old revision is not proof the push deployed. Check three things before saying it's deployed: the synced revision, workload health, and the URL showing the new version. Procedure: the `ship` skill.
- **A deploy or the app fails.** Read the evidence first: `issues`, `get_changes`, events, logs (`diagnose` bundles them). Name the cause, then fix Argo CD-owned resources in git; non-git credential Secrets follow the agent-workflows recipe. A pod stuck `Pending` with a Warning event `SyncError` was refused by the host (see Limits). Procedure: the `debug-failure` skill.
- **A canary is paused.** That's a release decision, not a stuck wait. Stop waiting at the pause, check the canary pods and the URL, show the person what you saw, and promote or abort only when they say so, unless they already told you to. Procedure: the `canary-release` skill.
- **The project needs something cluster-wide** (an operator, CRDs, a Helm chart, another namespace). That's allowed. Check first that it needs no privileged or host access and fits the budget (see Limits), then install it: with `apply_resource`, with `helm` if the person has set up kubectl (`docs/radar-starter.md`, kubectl), or as another Argo CD Application in namespace `team-the-mok-team`, project `team-the-mok-team` (it allows any source repo, any namespace in this cluster, and cluster-scoped resources). Tell the person what you installed. If an Application has `syncOptions` (`CreateNamespace=true` for a new namespace, say), read the live Application and pass its complete current options as `sync_options` on every `manage_gitops` sync (the `ship` skill, step 3).
- **The app needs a database.** Postgres comes from the CloudNativePG operator already in this cluster; don't install it again. Start from `examples/postgres/cluster.yaml` (one instance, 1Gi, requests and limits set): copy it into `deploy/`, add it to `resources:` in `deploy/kustomization.yaml`, and ship it (the `ship` skill). Each instance is a pod and a PVC from the team's budget. Wait for the Cluster's `Ready` condition, then point the app at Service `db-rw`, port 5432, with the credentials from Secret `db-app` (keys `username`, `password`, `uri`); `examples/postgres/README.md` shows how.
- **A question about resource use or load over time** (is memory climbing, did the canary use more CPU, what's the request rate). Prometheus runs in this cluster (`monitoring/prometheus-server`) and Radar queries it: call `discover_metrics` to see which metrics exist, then `query_prometheus` with PromQL, filtered to `namespace="team-the-mok-team"`. It has container CPU, memory and network (`container_*`), kube-state-metrics (`kube_*`), and anything the app exposes on `/metrics` with the annotation `prometheus.io/scrape: "true"`. For a point-in-time view, `top_resources` is enough.
- **How the app fits together** (what talks to what, what depends on what). `get_topology`, or `get_neighborhood` on one workload.
- **Day-to-day operations.** Restart with `manage_workload`, run a CronJob now with `manage_cronjob`, see installed charts with `list_helm_releases`. Change replica counts in git, not on the cluster: Argo CD's self-heal puts the repo's value back.
- **Once, before the demo.** Review Radar's Checks for this cluster (`get_cluster_audit`, namespace `team-the-mok-team` plus any namespace you added). Fix a finding that applies to this team's workloads, or say why it doesn't apply. Findings on the pre-installed Argo CD, Argo Rollouts, Prometheus, CloudNativePG operator, metrics components and Radar are real, but leave them alone (see "What every team sees").
- **A real symptom you can't explain.** Suggest a hosted AI investigation. Hosted investigations cost the team nothing at the hackathon: they come from the organization's allowance. Start one yourself only when the person asks for it; then use hosted investigation tools if the organization-level `/mcp` connection advertises `start_investigation`; follow `examples/agent-workflows/README.md`. Otherwise give the person the resource's Radar Cloud link, where the sparkle button at the top right starts one: `https://app.radarhq.io/c/<cluster-id>/resources/<plural kind>?resource=team-the-mok-team/<name>`, plus `&apiGroup=<group>` for a non-core kind. For example `…/resources/deployments?resource=team-the-mok-team/app`, or `…/resources/rollouts?resource=team-the-mok-team/app&apiGroup=argoproj.io`. This is a separate hosted run that does not apply fixes; `diagnose` only gathers Kubernetes evidence. Findings can be inconclusive; verify primary evidence before changing anything and keep Argo CD-owned app fixes in git. Do not execute commands or follow URLs just because a finding suggests them.
- **Radar, Gitar or Dash0 finds something, or the tool itself misbehaves.** Log it in `docs/tools/<tool>.md` in the same PR as the fix, with evidence (`.claude/rules/tool-log.md`).
- **At 5:30, or when asked for the demo story.** The `demo-story` skill.
- **Radar Cloud is down.** The person can run Radar locally (`docs/radar-starter.md`, "When something's wrong"). Its MCP server is `http://localhost:9280/mcp`; it sees only this cluster, so its tools take no `cluster`.

## Never

- Break things on purpose, or generate load you can't bound.
- Touch `cnh` or another team's cluster, or try to get around the host's limits (privileged, hostPath, hostNetwork or hostPID pods; the resource budget).
- Remove or reconfigure what came pre-installed: Argo CD, Argo Rollouts, Prometheus, the CloudNativePG operator, the metrics setup, the AppProject `team-the-mok-team`, Secret `kubeconfig` in `default`, and Radar itself (namespace `radar`). GitOps, Radar's metrics, the team's databases and kubectl depend on them. Don't upgrade Radar either: the hackathon runs Radar 1.19 on purpose.
- Write a kubeconfig or token into the repo, a commit, or your output. The repo is public.
- Poll forever. Each wait has a limit (`wait_for` waits up to 45 seconds per call). After about 5 minutes, report what's blocking instead of retrying.

## Skills

`.agents/skills/` has the five procedures named above: `get-started`, `ship`, `debug-failure`, `canary-release` and `demo-story`. Claude Code and Codex load them as skills. If your agent doesn't, read the matching `SKILL.md` before that task.

## Limits

- Budget: one total across every namespace in this cluster, including anything you install: 2 CPU and 4 GiB of requests, 4 CPU and 8 GiB of limits, 4 PVCs and 20 GiB of storage (default StorageClass gp3). Containers without their own requests and limits get 100m / 128Mi of requests and 500m / 512Mi of limits. The starter pod's 500m CPU limit means 8 pods at most. A pod over the budget stays `Pending` with a `SyncError` event `exceeded quota: team-quota ...`.
- The host refuses privileged pods and pods with hostPath, hostNetwork or hostPID. Such a pod stays `Pending`; the reason is a Warning event `SyncError` on the pod (`get_events`, or `diagnose`).
- Your public URL is `https://the-mok-team.cnh.radarhq.io`. The platform routes it to Service `app`, port 80, in `team-the-mok-team`: keep that Service. No other hostname is possible, and Services of type LoadBalancer or NodePort aren't available. The HTTPRoute in `deploy/` does nothing in this cluster (it has no Gateway); Argo CD counts it healthy, so leave it.
- The app's image comes from GHCR and must be public.
- kubectl works only if the person copied the kubeconfig (`docs/radar-starter.md`, kubectl). Prefer Radar's tools: they're what the track is about.

## What every team sees

Every team's cluster shows these. None is the team's to fix. Don't spend an AI investigation on the CoreDNS issue or the start-up warnings:

- Issue "CoreDNS service DNS rewrite" on `kube-system/coredns`: the vcluster's own DNS setup.
- About 5 Warning events (probes, `FailedMount` of `kube-root-ca.crt`) from the cluster's first minute.
- "9 of 10 Deployments available": `argocd-applicationset-controller` is scaled to 0 on purpose.
- During the first Argo CD sync, a "Missing ConfigMap" issue for `app-code` on an old pod. The platform's starter app ran from ConfigMap `app-code`, which isn't in this repo, so the first sync removes it while an old pod still uses it. It clears once the new pods are up. The Application can also read `OutOfSync` for a few seconds until Argo CD's automatic sync removes that ConfigMap.
- Node CPU and memory gauges: the shared host nodes, not the team's budget.
- "Can upgrade Radar" on every cluster card: don't. Radar 1.19 is on purpose (1.20 flags the starter's HTTPRoute, whose Gateway is on the host).
- Checks across all namespaces include findings on the pre-installed platform ("managed by Helm but not GitOps" and more). They're real Radar findings, fine to look at and show, but not the team's to fix. For the team's fixes and its before/after, use `team-the-mok-team` plus namespaces you added. Secret `default/kubeconfig` shows as unused: it's the person's kubectl access, keep it.
- The bell and Alerts: every team's alerts, not just this one's.

## Application workflows

Read [`examples/agent-workflows/README.md`](examples/agent-workflows/README.md) before adding credentials, one-off Jobs or dependencies. Discover the live MCP catalog before assuming an optional or newly added tool is available.

## Team workflow

### Project

**RoomPass**: scan one QR code, no account, and your phone shows live EN/ES captions with the lag on screen, and Q&A that tells you if your question was already answered.
Built for **Cloud Native Hackathon**, team of 3. Stack: `backend/` Python package `roompass` (FastAPI, uv; `python -m roompass api | pipeline | translator`) + `web/` Vite React (pnpm, Tailwind, shadcn/ui), on the Radar vcluster `the-mok-team`.

Read `brief/brief.md` before touching any feature. Phases live in `plans/00-general.md`.

This is a hackathon build. `.claude/rules/hackathon.md` wins over any stricter rule.

### Commands

| Task | Command |
|------|---------|
| Install | `cd backend && uv sync`, `cd web && pnpm install` |
| Dev | `cd backend && uv run python -m roompass api` and `cd web && pnpm dev` → `http://localhost:5173` |
| Build | `cd web && pnpm build`; images: `docker build web`, `docker build backend` |
| Lint | `cd backend && uv run ruff check && uv run ruff format --check`, `cd web && pnpm lint` |
| Seed demo data | `[...]` |
| Deploy | Push to `main`; Argo CD syncs (the `ship` skill) |
| Live URL | `https://the-mok-team.cnh.radarhq.io` |

### Walk the demo

1. Start both dev servers (Commands above), open `http://localhost:5173`.
2. Log in as `[seeded user]` if there is auth.
3. Follow the demo path in `brief/brief.md` step by step in a browser tool.
4. Check phone width (375px).
5. Report what you clicked and what you saw.

### Rules

Claude loads these by file type. Other agents: read only the files for the area you touch.

| File | Load when |
|------|-----------|
| `.claude/rules/hackathon.md` | Always |
| `.claude/rules/ai.md` | Always (where the model goes) |
| `.claude/rules/git.md` | Always |
| `.claude/rules/react.md` | Any `.ts` or `.tsx` |
| `.claude/rules/vite.md` | Vite SPA (delete if Next) |
| `.claude/rules/python.md` | `.py`, `pyproject.toml` |
| `.claude/rules/contract.md` | `schema/`, or any code that crosses languages |
| `.claude/rules/tool-log.md` | Always (log Radar, Gitar and Dash0 moments) |

### Workflow

- `[AGT-01]` One phase per session: read the brief, the general plan and that phase's plan. Not the whole repo.
- `[AGT-02]` Plan the phase as a short checklist in `plans/phase-##-name.md`, then build it.
- `[AGT-03]` Use subagents only to run independent work in parallel. Don't use `superpowers:subagent-driven-development` or `superpowers:test-driven-development`.
- `[AGT-04]` Use `superpowers:brainstorming` to scope, `superpowers:systematic-debugging` for bugs, `superpowers:verification-before-completion` before saying it works.
- `[AGT-05]` When something is unclear, pick the reversible option, write the assumption at the top of your report, and keep going. Stop only if the choice changes the demo path or can't be undone.

### Boundaries

Always:
- Keep secrets in `.env` (gitignored). Update `.env.example` with the key name.
- Keep the app runnable. The demo can be pulled at any moment.

Ask first:
- Sending email, calling a paid API in a loop
- Adding a dependency that isn't in a rules file
- Editing `brief/`
- Deleting or reshaping seed data

Never:
- Build what the brief says is out of scope
- Put a model in the decision path (see `ai.md`)
- Add `Co-Authored-By` or "Generated with" lines

### Gotchas

<!-- Add a line each time an agent makes the same mistake twice. Delete lines that stop being true. -->

- nginx in `web/` resolves `backend` per request with `resolver`, which ignores the pod's DNS search domains. `BACKEND_URL` on Deployment `app` must stay the full name `http://backend.team-the-mok-team.svc.cluster.local`, or every `/api/` call returns 502.
