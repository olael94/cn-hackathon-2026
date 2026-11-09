# Tool Log Rules

Judges score the sponsor tracks on what Radar, Gitar and Dash0 did for us during the day. Write it down when it happens, not at 5:30.

- `[LOG-01]` Log in `docs/tools/radar.md`, `docs/tools/gitar.md` or `docs/tools/dash0.md`. Nowhere else.
- `[LOG-02]` Log a pivotal moment: a finding taken or rejected, an incident found or fixed with the tool, an AI investigation or Agent0 answer, an audit before/after.
- `[LOG-03]` Log a tooling problem under `## Tooling problems`: the tool failed, missed something, behaved differently from its docs, or needed a workaround. Say what we did instead.
- `[LOG-04]` Every entry has evidence: PR number, commit, pod or resource, and local time. Quote the exact error or finding title.
- `[LOG-05]` The entry lands in the same PR as the fix. No fix yet: log it with status `Open`.
- `[LOG-06]` After reading Gitar's comment on a PR, add one row per finding to the table in `docs/tools/gitar.md`, then keep its outcome current.
- `[LOG-07]` Plain short sentences. Facts, not praise.
