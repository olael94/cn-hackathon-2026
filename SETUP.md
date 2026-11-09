# Team setup: the-mok-team

How our environment is wired. Nothing here is secret; keys live in `.env` (gitignored) and in a
Kubernetes Secret in the cluster.

## Services

| Service | What we use | Where |
|---|---|---|
| Cluster | Radar-hosted vcluster `the-mok-team`, namespace `team-the-mok-team` | Radar Cloud: https://app.radarhq.io |
| Public URL | Argo CD deploys every merge to `main` | https://the-mok-team.cnh.radarhq.io |
| Build | GitHub Action builds the image to `ghcr.io/olael94/cn-hackathon-2026` (public) | Actions tab |
| Code review | Gitar reviews every PR | PR comments, https://app.gitar.ai |
| Search | Elastic Cloud serverless, Vector Database project, AWS us-west-2 | https://cloud.elastic.co |
| Observability | Dash0 org in us-west-2 (OTLP gRPC) | https://app.dash0.com |
| AI | OpenAI: `gpt-live-transcribe`, `gpt-transcribe`, `text-embedding-3-small` | https://platform.openai.com |

Elastic Cloud's default `semantic_text` model is `.jina-embeddings-v5-text-small` (hosted and
multilingual). In testing, an English query matched a Spanish sentence with no shared words.

## Joining the team (each teammate)

1. Accept the GitHub invite, then clone:
   ```bash
   git clone git@github.com:olael94/cn-hackathon-2026.git
   ```
2. Get `.env` from Oliver through AirDrop or a password manager. Never through chat or git.
3. Accept the Radar Cloud invite and sign in at https://app.radarhq.io. If it says
   "No Namespace Access", wait two minutes and reload.
4. Accept the Dash0 invite.
5. Optional, for Claude Code: add the MCP servers.
   ```bash
   claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp
   ```
   Then `/mcp` > radar-cloud > Authenticate > Cloud Native Hackathon.

## How work ships

1. Branch from `main`, build the feature, open a PR.
2. Gitar reviews it. Fix what it flags.
3. Merge. The Action builds the image and commits `deploy: <sha>` to `main`; Argo CD syncs it.
4. `git pull` before your next branch (the bot's deploy commit lands on `main`).

## Secrets in the cluster

The deployed app reads keys from Secret `app-credentials` in `team-the-mok-team`. Create it from
`.env` so no key is pasted anywhere (needs the kubeconfig from Radar Cloud, saved outside the repo
as `~/cnh-kubeconfig`):

```bash
set -a && . ./.env && set +a && KUBECONFIG=~/cnh-kubeconfig kubectl -n team-the-mok-team create secret generic app-credentials --from-literal=openai-api-key="$OPENAI_API_KEY" --from-literal=es-url="$ES_URL" --from-literal=es-api-key="$ES_API_KEY" --from-literal=dash0-auth-token="$DASH0_AUTH_TOKEN" --from-literal=otel-endpoint="$OTEL_EXPORTER_OTLP_ENDPOINT"
```

## Fallbacks

- `scripts/local-cluster.sh <team>` builds a laptop copy of the hackathon cluster if the shared
  one has problems.
- `elastic-start-local/` (gitignored, on Oliver's Mac) is a local Elasticsearch + Kibana:
  `open -a Docker` then `cd elastic-start-local && sh start.sh`.

## Known snags

- Dash0 MCP OAuth failed with `code_challenge_method must be "S256"`; we registered it with the
  auth token header instead.
- Shell-sourcing `.env` needs the OTLP header value quoted, with the space encoded as `%20`.
- The first two Radar team names (`papachurros`, `mok-team`) failed or were abandoned; ask the
  Radar table to remove them.
