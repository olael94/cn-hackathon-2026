---
title: "Contract stays in sync"
description: "CONTRACT.md, contract.py and contract.ts change together"
when: "PRs that change CONTRACT.md, backend/roompass/contract.py, web/src/api/contract.ts, an API route under backend/roompass/, or an SSE event"
actions: "Request changes listing each file that is missing from the PR"
type: check
---

# Contract stays in sync

Three people build against `CONTRACT.md` at the same time. A shape that changes in one place and not the others breaks the other lanes.

Pass when every shape, endpoint, status code or SSE event the PR adds or changes appears with the same names and types in all three:

- `CONTRACT.md`
- `backend/roompass/contract.py` (pydantic)
- `web/src/api/contract.ts` (zod)

Fail and name the missing file when one of them is not updated. Docs-only changes to `CONTRACT.md` that do not change a shape, endpoint, status code or event pass.
