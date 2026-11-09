# Privacy and Secrets (Public Repo)

This repo is public and the app records people speaking.

- No API keys, tokens, kubeconfigs or passwords in code, YAML, tests, fixtures or docs. Secrets come from env vars only. `.env` stays gitignored; new variables go in `.env.example` with an empty value.
- `VITE_*` variables end up in the public JavaScript bundle. Flag any `VITE_` variable holding a secret other than the Dash0 RUM ingest token.
- Never log or put in span attributes: transcript text, question text, raw audio, speaker tokens or device ids in full. Log talk ids, sequence numbers, counts, sizes and timings.
- Speaker tokens are stored hashed (`speaker_token_hash`), never in plain text, and compared in constant time.
- The speaker token travels in the URL hash and the `X-Speaker-Token` header. Flag code that puts it in a query string or path.
- Raw audio chunks are not stored after transcription.
