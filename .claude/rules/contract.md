---
paths:
  - "CONTRACT.md"
  - "backend/contract.py"
  - "web/src/api/contract.ts"
---

# Contract Rules

`backend/` (Python) and `web/` (TypeScript) share data. Keep them in sync by hand, from one file.

- `[CT-01]` `CONTRACT.md` is the single source of truth for every shape, endpoint, status code and SSE event that crosses the boundary.
- `[CT-02]` `backend/contract.py` (pydantic) and `web/src/api/contract.ts` (zod) mirror it with the same field names and types. No code generation: it costs more time than it saves today.
- `[CT-03]` A contract change updates `CONTRACT.md`, `contract.py` and `contract.ts` in the same PR.
- `[CT-04]` Changing the contract is "ask first". Other people are building against it in parallel.
- `[CT-05]` Every backend route lives under `/api`, because nginx in `web/` only forwards `/api/`.
