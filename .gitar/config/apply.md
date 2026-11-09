# Auto-Apply Criteria

Auto-apply fixes so CI goes green, but a human decides anything that changes behavior, the deploy or the contract.

## Gitar may auto-apply
- Lint and format fixes (`ruff check`, `ruff format`, `oxlint`).
- TypeScript type errors and failing `pnpm build` in `web/`.
- Failing `pytest` or import errors in `backend/` when the fix is in application code, not in the test's expected values.
- Missing imports, unused variables, typos in code.
- Missing `aria-label`s and other accessibility fixes from `.gitar/review/accessibility.md`.

## Gitar must not auto-apply (suggest only)
- Anything in `deploy/`, `argocd/`, `.github/workflows/` or `.gitar/`.
- `CONTRACT.md`, `schema/`, `backend/roompass/contract.py`, `web/src/api/contract.ts`, or the generated folders `backend/roompass/generated/` and `web/src/types/generated/`.
- Anything touching secrets, env var names, `.env.example` or auth (speaker token handling).
- Changes to the citation validator or the "possibly covered" thresholds.
- Deleting or weakening a test to make CI pass.
