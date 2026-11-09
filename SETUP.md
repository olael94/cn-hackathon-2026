# Setup status (prepared Nov 9, 2026, ~00:30)

Everything below was installed and smoke-tested on this Mac. Nothing here is app code.
If we don't use a tool, its removal command is in the last section.

## Ready and tested

| Tool | Version | Test that passed |
|---|---|---|
| Docker Desktop | 29.9.2, 16 GB RAM | Running |
| Elasticsearch + Kibana (start-local) | 9.5.6 | API key auth OK; `semantic_text` index matched "Linux kernel packet monitoring" to an eBPF sentence with zero shared words |
| ELSER (English semantic) | `.elser-2-elasticsearch` | Warm, no download needed on venue Wi-Fi |
| Multilingual E5 (Spanish) | `.multilingual-e5-small-elasticsearch` | Embedded a Spanish sentence, 384 dims |
| minikube | Kubernetes 1.33.1, metrics-server on | Node Ready |
| Radar | 1.20.2 | UI at http://localhost:9280, MCP at `/mcp` registered in Claude Code (Connected) |
| Dash0 CLI | 1.20.0 | Installed, not logged in yet |
| gh, helm, uv | 2.103.3, 4.3.1, 0.13.7 | Installed |
| Python cache | fastapi 0.162, openai 2.54, elasticsearch 9.5, OTel, openlit | Warm in uv cache |
| Node cache | Next.js 16.4.5, React 19.3, @vercel/otel, OTel web SDK | Warm in pnpm store, test build passed |
| Base images | python:3.13-slim, node:24-slim, otel collector contrib | Pulled |

Repo: `git init` done, `.gitignore` and `.env.example` staged, **not committed yet**.
`.env` exists (gitignored) with the Elasticsearch values filled in.

## Verified facts (closes open questions in CLAUDE.md section 11)

- OpenAI transcription: `gpt-live-transcribe` (realtime, live mic) and `gpt-transcribe` (recorded chunks, supports `stream=true`). `gpt-4o-transcribe` and `whisper-1` are deprecated (shutdown Feb 26, 2027).
- OpenAI embeddings: `text-embedding-3-small` (1536 dims), `text-embedding-3-large` (3072 dims).
- Note: Elasticsearch's built-in ELSER and E5 can replace OpenAI embeddings entirely, which is less code and fewer API calls.

## YOU must do these (accounts and logins, I can't)

1. **OpenAI key**: create a key, paste it into `.env` as `OPENAI_API_KEY`. Confirm hackathon credits apply.
2. **GitHub CLI login**: `gh auth login` (browser flow).
3. **GitHub repo**: tell me and I'll create it with `gh repo create` (private until submission).
4. **Gitar**: install the GitHub App on that repo, start the 14-day Pro trial (https://docs.gitar.ai/quickstart).
5. **Dash0**: sign up (https://www.dash0.com/sign-up). Then:
   - Settings > Endpoints: copy the OTLP endpoint into `.env`.
   - Settings > Auth Tokens: copy a token into `DASH0_AUTH_TOKEN`.
   - `dash0 login --profile default --api-url https://api.<region>.aws.dash0.com`
   - Add the MCP server: `claude mcp add --transport http --scope local dash0 https://api.<region>.aws.dash0.com/mcp`, then `/mcp` in a Claude terminal to sign in.
6. **Phone mic test**: Next.js dev server on `0.0.0.0` reached from your phone needs HTTPS for mic access (browsers block `getUserMedia` on plain http except localhost). Plan: `next dev --experimental-https` or a tunnel. Test with real background noise.

## Day-of start commands

```bash
open -a Docker
```

```bash
cd elastic-start-local && sh start.sh
```

```bash
minikube start
```

```bash
radar -no-browser
```

Kibana: http://localhost:5601 (user `elastic`, password in `elastic-start-local/.env`).

## Removal (if a tool isn't used)

| Remove | Command |
|---|---|
| Elasticsearch + Kibana (containers, volumes, folder) | `cd elastic-start-local && sh uninstall.sh` |
| minikube cluster | `minikube stop` (or `minikube delete` to wipe it) |
| Radar | `claude mcp remove radar -s local && rm /opt/homebrew/bin/kubectl-radar /opt/homebrew/bin/radar` |
| Dash0 CLI | `brew uninstall --cask dash0` |
| gh / helm / uv | `brew uninstall gh helm uv` |
| Cached images | `docker rmi otel/opentelemetry-collector-contrib:latest` (etc.) |
