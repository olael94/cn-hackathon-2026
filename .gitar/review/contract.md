# Contract Between Backend and Web

`CONTRACT.md` is the agreement between `backend/` and `web/`. Three people build against it in parallel.

- Any change to a request body, response field, endpoint path, status code or SSE event name must update `CONTRACT.md` in the same PR. Flag the PR if it doesn't.
- `schema/*.json` must match `CONTRACT.md`. A schema change must also commit the regenerated files from `scripts/gen-types.sh` in `backend/roompass/generated/` and `web/src/types/generated/`.
- Flag any hand edit to a generated file, and any hand-written pydantic model or TypeScript type that duplicates a shape from `schema/`.
- Flag code in `web/` that reads a response field the backend no longer returns, or under an old name.
- Every backend route must live under `/api`. nginx in `web/` only forwards `/api/`, so anything else returns the frontend's `index.html`.
- Segment ids are always `{talk_id}-{seq}`. Flag any other format.
- Offsets (`t_start`, `t_end`) are seconds from talk start, taken from the audio. Flag code that computes them from the server's wall clock.
