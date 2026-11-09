---
title: "Tool finding is logged"
description: "A fix for a Gitar, Radar or Dash0 finding adds an entry to docs/tools"
when: "PRs whose title, body or commits say they fix a Gitar finding, a Radar incident or check, or a Dash0 alert, SLO or Agent0 finding"
actions: "Request changes asking for the docs/tools entry"
type: check
---

# Tool finding is logged

The sponsor tracks are judged on what Radar, Gitar and Dash0 did for us during the day, so every fix they led to is written down when it lands.

Pass when the PR adds or updates an entry in `docs/tools/gitar.md`, `docs/tools/radar.md` or `docs/tools/dash0.md` for the finding it fixes, with the PR number, commit or resource, and the outcome.

Fail and name the file that needs the entry when it is missing. The rule follows `.claude/rules/tool-log.md`.
