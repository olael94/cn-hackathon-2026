# Dash0 in RoomPass

The SLO watches caption lag measured on the backend. The lag on the phone ("live · 6.2s behind") is still seeded, so for now the product screen and the ops screen show different numbers.

## What we instrument

| Signal | Where it comes from | What we look at |
|---|---|---|
| Traces | Backend: `opentelemetry-instrument` (FastAPI auto-instrumentation) plus manual spans from `CONTRACT.md` ("Telemetry names"). One trace per audio chunk. | `pipeline.transcribe`, `pipeline.translate`, `pipeline.index`, `pipeline.publish`, `questions.check`, `themes.build`, `catchup.generate` |
| Metrics | Dash0 synthetic span metrics (`dash0.spans`, `dash0.spans.duration`), log counts (`dash0.logs`) and uptime check runs (`dash0.synthetic_check.runs`) | p95 per span, error rate per span, share of late captions, uptime |
| Logs | Backend logs exported over OTLP | IDs, counts and timings only. Never transcript or question text. |
| RUM | `@dash0/sdk-web` in `web/src/telemetry.ts`: page views, fetch calls, errors, web vitals | How each phone loads and fails |

How lag gets to Dash0: the backend measures it. When `flush()` publishes a caption, the `pipeline.publish` span gets `roompass.caption.lag` (seconds from the audio chunk arriving to the caption going out) and `roompass.caption.late` (`"true"` over 10 s, else `"false"`). Dash0 counts those spans in `dash0.spans` with a `roompass_caption_late` label. This is server-side lag only: it leaves out the speaker's upload and the phone's network. The phone can't report its own lag yet, because it still shows seeded captions (`web/src/demoRoom.ts`).

## The SLOs

**Captions on time: 95% under 10 s.** Dash0 SLOs are a ratio of good events to all events. "95% of caption lines reach the phone within 10 s" is the same thing as p95 lag under 10 s.

- Good: `pipeline.publish` spans with `roompass_caption_late="false"`
- Total: all `pipeline.publish` spans
- Window: rolling 28 days (the only window Dash0 offers today)

**Public URL uptime: 99%.** An uptime check calls `https://the-mok-team.cnh.radarhq.io/api/health` every minute from us-oregon. Good: checks that pass. This one has data from day one.

## Dashboard, alerts and SLOs as code

Everything lives in `dash0/` and is applied with the Dash0 CLI. `.github/workflows/dash0.yaml` runs `dash0 apply -f dash0/` on every push to `main` that touches `dash0/` (secret `DASH0_API_TOKEN`). A second apply with no changes prints `no changes`.

| File | What it creates |
|---|---|
| `dash0/dashboard.yaml` | Dashboard "RoomPass health": late captions %, captions per minute, pipeline stage p95, pipeline errors, translate p95 by fallback, Q&A and themes p95, requests, server errors, server p95, uptime |
| `dash0/alerts.yaml` | Check rules `CaptionsLate` (over 5% late for 30 s), `PipelineErrors`, `ServerErrors`, `PublicUrlDown`. They email the Default Notification Channel |
| `dash0/slo.yaml` | The two SLOs above |
| `dash0/uptime.yaml` | The uptime check on the public URL |

The SLO's burn-rate alerts are tuned for a 28-day window, and SLOs settle about 5 minutes behind live data. A two-minute chaos run won't move them on stage, so `CaptionsLate` is the alert shown in the demo.

To change something: edit the file, run `dash0 --agent-mode apply -f dash0/ --dry-run`, then merge. Locally, `dash0 apply -f dash0/` with the `roompass` CLI profile does the same.

The fallback panel splits `pipeline.translate` by `translator.fallback`, which `translate()` sets to true when the remote translator fails and the backend translates locally.

**Not built yet:** nothing reads `translator-chaos-delay-ms`. `python -m roompass translator` still exits with "not built yet", so steps 2 and 3 below can't run until the translator applies that delay.

## Chaos demo beat (demo path step 4)

1. A talk is live. Phones show "live · 1.4s behind". Dashboard and SLO page open on the laptop.
2. Flip the flagd flag `translator-chaos-delay-ms` to its `on` variant (10000 ms in `deploy/flagd.yaml`). Each translation now waits that long.
3. On the phone the lag climbs past 10 s. On the dashboard, late captions go over 5% and `pipeline.translate` p95 jumps while the other spans stay flat. `CaptionsLate` fires. The SLO's SLI drops a few minutes later.
4. Ask Agent0: "Why is caption lag up?" It should point at `pipeline.translate` (span durations in the traces of the slow segments).
5. Flip `translator-fallback` on. Lag on the phone drops back within seconds. The dashboard follows within about two minutes (2-minute rate window, so it always spans at least two 1-minute aggregations).
6. Flip both flags back off after the demo.

## Things to check on the day

- The late flag is a string (`"true"` / `"false"`). Span attributes become labels on `dash0.spans`: `translator.remote` queried as `translator_remote="true"` (`dash0 metrics instant`, 2026-11-09). After the first live talk, check that `roompass_caption_late` shows up the same way.
- The phone SDK needs the OTLP over HTTP endpoint and an ingest-only token (`VITE_DASH0_ENDPOINT`, `VITE_DASH0_AUTH_TOKEN`, set in GitHub for the web image build).

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:05 PM | The Dash0 web SDK (0.30.0) has no metrics API, only `sendEvent`, so the phone can't report `roompass.caption.lag` as a metric the way CONTRACT.md says. | The phone sends `sendEvent('roompass.caption.lag', ...)` with the lag as an attribute, and a SignalControl rule turns it into a histogram. Not yet confirmed that web events pass through SignalControl. |
| 2026-11-09, 3:05 PM | Native SLOs use a fixed 28-day window, so the fastest burn alert needs about 2% of the budget in an hour. A 2-minute chaos run may not trip it. | Added a check rule (p95 over 10 s for 30 s) as the alert shown in the demo. |
| 2026-11-09, 3:05 PM | `backend/Dockerfile` sets `OTEL_SDK_DISABLED=true`, so the backend sends nothing until the `otel` Secret overrides it. | The `otel` Secret must set `OTEL_SDK_DISABLED: "false"`. |
| 2026-11-09, 3:09 PM | Gitar on PR #14: `[1m]` rate windows can return no data with a 1-minute SignalControl aggregation. | Taken. Every rate window widened to `[2m]` (dashboard JSON and check rule). |
| 2026-11-09, 4:00 PM | Dash0 had no backend or translator data at all: only three setup test spans in 24 h. The `otel` Secret existed but had no `OTEL_SDK_DISABLED` key, so the image default (`true`) still won. Found by querying spans with the Dash0 CLI, then reading the Secret's keys through Radar. | Added `OTEL_SDK_DISABLED=false` to the Secret and restarted both pods. Spans for `backend` and `translator` showed up within a minute. |
| 2026-11-09, 4:00 PM | The live web bundle had no Dash0 endpoint: `VITE_DASH0_ENDPOINT` and `VITE_DASH0_AUTH_TOKEN` were not set in GitHub, so RUM never started. | Set both. RUM starts with the next web build on `main`. |
| 2026-11-09, 4:05 PM | Dash0's MCP server can read dashboards but not create them, and the CLI's short `SyntheticCheck` example is rejected (`synthetic check type is unknown`). | Built everything as files in `dash0/` and applied them with the CLI. The uptime check uses the full `plugin: kind: http` form from Dash0's Terraform examples. |
| 2026-11-09, 4:05 PM | The SignalControl histogram for lag was never confirmed. | Tested the fallback: an event attribute shows up as a countable label on `dash0.logs`. The SLO, alert and dashboard use `roompass_caption_late` instead. |
| 2026-11-09, 4:05 PM | The `otel` Secret created at 3:55 PM had the endpoint, headers and dataset but not `OTEL_SDK_DISABLED: "false"`, so the backend still sent nothing. Found by re-reading the row above while syncing the tool logs. | The Secret script now adds `OTEL_SDK_DISABLED: "false"`. Re-apply the `otel` Secret, restart `backend` and `translator`, then check for `backend` traces in Dash0. |

