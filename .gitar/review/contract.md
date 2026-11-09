# Contract Between Backend and Web

`CONTRACT.md` is the agreement between `backend/` and `web/`. Three people build against it in parallel.

- Any change to a request body, response field, endpoint path, status code or SSE event name must update `CONTRACT.md` in the same PR. Flag the PR if it doesn't.
- `backend/roompass/contract.py` (pydantic) and `web/src/api/contract.ts` (zod) must describe the same fields with the same names and types. Flag any field present in one and missing in the other.
- Flag code in `web/` that reads a response field the backend no longer returns, or under an old name.
- Every backend route must live under `/api`. nginx in `web/` only forwards `/api/`, so anything else returns the frontend's `index.html`.
- Segment ids are always `{talk_id}-{seq}`. Flag any other format.
- Offsets (`t_start`, `t_end`) are seconds from talk start, taken from the audio. Flag code that computes them from the server's wall clock.
