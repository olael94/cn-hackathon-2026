---
paths:
  - "CONTRACT.md"
  - "schema/**"
  - "backend/roompass/contract.py"
  - "web/src/api/contract.ts"
  - "backend/roompass/generated/**"
  - "web/src/types/generated/**"
---

# Contract Rules

`backend/` (Python) and `web/` (TypeScript) share data through one contract.

- `[CT-01]` `CONTRACT.md` describes every shape, endpoint, status code and SSE event that crosses the boundary. `schema/*.json` (JSON Schema) is its code form.
- `[CT-02]` Generate types with `scripts/gen-types.sh`, never hand-copy them: pydantic into `backend/roompass/generated/`, TypeScript into `web/src/types/generated/`.
- `[CT-03]` Import shared shapes only from `backend/roompass/contract.py` and `web/src/api/contract.ts`. Those two files re-export the generated types and hold nothing hand-written that duplicates a schema.
- `[CT-04]` Generated files are never edited. Change the schema, then regenerate. One example per schema in `schema/examples/`.
- `[CT-05]` A contract change updates `CONTRACT.md`, the schema and the generated files in the same PR, and is "ask first". Other people are building against it in parallel.
- `[CT-06]` Every backend route lives under `/api`, because nginx in `web/` only forwards `/api/`.
