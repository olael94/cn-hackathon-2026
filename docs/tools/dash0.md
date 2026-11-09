# Dash0 in RoomPass

The lag number on the phone ("live · 6.2s behind") is the same number our SLO watches in Dash0. The product screen and the ops screen show one signal.

## What we instrument

| Signal | Where it comes from | What we look at |
|---|---|---|
| Traces | Backend: `opentelemetry-instrument` (FastAPI auto-instrumentation) plus manual spans from `CONTRACT.md` ("Telemetry names"). One trace per audio chunk. | `pipeline.transcribe`, `pipeline.translate`, `pipeline.index`, `pipeline.publish`, `questions.check`, `themes.build`, `catchup.generate` |
| Metrics | Dash0 synthetic span metrics (`dash0.spans`, `dash0.spans.duration`), plus the lag histogram below | p95 per span, error rate per span, caption lag p50/p95 |
| Logs | Backend logs exported over OTLP, and the phone's custom events (the web SDK sends events as log records) | IDs, counts and timings only. Never transcript or question text. |
| RUM | `@dash0/sdk-web` in `web/src/telemetry.ts`: page views, fetch calls, errors, web vitals, and the `roompass.caption.lag` event | Lag per talk, as each phone sees it |

How lag gets to Dash0: the web SDK has no metrics API, only `sendEvent`. So each phone sends a custom event named `roompass.caption.lag` with a number attribute `roompass.caption.lag` (seconds) and `talk.id`. A Dash0 SignalControl rule turns those events into a histogram metric with the same name. That histogram feeds the SLO, the check rule and the dashboard.

## The SLO

**Caption lag p95 under 10 s.** Dash0 SLOs are a ratio of good events to all events, so we say it as "95% of caption lines reach the phone within 10 s". That is the same thing as p95 under 10 s.

- Good: lag events at or under 10 s
- Total: all lag events
- Target: 95%
- Window: rolling 28 days (the only window Dash0 offers today)

## Set it up in Dash0 (click by click)

### 1. Turn the lag event into a histogram (SignalControl)

1. Open **SignalControl**.
2. In the logs pipeline, open the **Convert to metrics** stage, then **Add conversion rule**.
3. Rule name: `caption lag`. Metric name: `roompass.caption.lag`.
4. Target dataset: **Original**.
5. Filter: `event.name` is `roompass.caption.lag`. Do not leave filters empty.
6. Metric type: **Exponential histogram**. Value: simple mode, attribute `roompass.caption.lag`.
7. Aggregation interval: the shortest one offered (1 minute or less).
8. Keep signal attributes: `talk.id`. Keep resource attributes: `service.name`.
9. Turn on **Enabled**, then **Save**.
10. Check: open the query builder, run `histogram_count(sum(rate({otel_metric_name="roompass.caption.lag"}[5m])))` while a phone has a talk open. It should be above 0.

### 2. Create the SLO

1. Open **Alerting > SLOs**.
2. From the create button's **More create options**, pick **Manually**. (Or click **Create with Agent0** and paste the queries below.)
3. SLI shape: **Good / Total**. If the form asks whether the query is a counter, say no (the queries already use `increase`).
4. Good query:
   ```
   histogram_fraction(0, 10, sum(increase({otel_metric_name="roompass.caption.lag"}[5m]))) * histogram_count(sum(increase({otel_metric_name="roompass.caption.lag"}[5m])))
   ```
5. Total query:
   ```
   histogram_count(sum(increase({otel_metric_name="roompass.caption.lag"}[5m])))
   ```
6. Check the live SLI preview shows a value near 1.
7. Target: `95`. Name: `Caption lag p95 under 10 s`. Description: `Share of caption lines that reach the phone within 10 s.`
8. Save. It shows a **New** badge and data a few minutes later.

### 3. Create the check rule (the alert you see in the demo)

The SLO's burn-rate alerts are tuned for a 28-day window: the fastest one needs about 2% of the budget spent in one hour. A two-minute chaos run may not trip it. So we add a plain check rule that reacts in about two minutes.

1. Open **Alerting > Check rules**, then add a rule. (Or run the lag query in the query builder and click **Create check rule**.)
2. Name: `Caption lag p95 over 10 s`.
3. Expression:
   ```
   histogram_quantile(0.95, sum(rate({otel_metric_name="roompass.caption.lag"}[2m]))) > 10
   ```
4. For: `30s`. Severity: critical.
5. Save.

### 4. Import the dashboard

1. Open **Dashboards**, click **+ Add**.
2. In the top-right of the editor, click **Edit as JSON**.
3. Paste or upload `docs/tools/dash0-dashboard.json`.
4. Click **Apply**, then save.

Panels: caption lag p50/p95 against the 10 s line, p95 for each pipeline span, p95 for `questions.check` and `themes.build`, and error rate per span.

## Chaos demo beat (demo path step 4)

1. A talk is live. Phones show "live · 1.4s behind". Dashboard and SLO page open on the laptop.
2. Flip the flagd flag `translator-chaos-delay-ms` to its `on` variant (10000 ms in `deploy/flagd.yaml`). Each translation now waits that long.
3. On the phone the lag climbs past 10 s. On the dashboard, caption lag p95 crosses the 10 s line and `pipeline.translate` p95 jumps while the other spans stay flat. The check rule fires. The SLO's SLI drops and the error budget goes down.
4. Ask Agent0: "Why is caption lag up?" It should point at `pipeline.translate` (span durations in the traces of the slow segments).
5. Flip `translator-fallback` on. Lag on the phone drops back within seconds. The dashboard follows within about two minutes (2-minute rate window, so it always spans at least two 1-minute aggregations).
6. Flip both flags back off after the demo.

## Things to check on the day

- Web SDK events reaching SignalControl is not confirmed in the docs. If step 1's check stays at 0, fall back: ask the web lane to also send a string attribute `roompass.caption.lag_ok` (`"true"` or `"false"`), and build the SLO as Good / Total on `dash0.web.events` filtered by that attribute. The dashboard lag panel would then need a different query.
- The span name label is assumed to be `otel_span_name`. If the span panels are empty, open the query builder, group `dash0.spans.duration` by span name, and copy the label it uses.
- The histogram drops negative values. A phone with a bad clock offset can report lag below 0; the web lane should clamp lag to 0 before sending.
- The phone SDK needs the OTLP over HTTP endpoint and an ingest-only token (`VITE_DASH0_ENDPOINT`, `VITE_DASH0_AUTH_TOKEN`, set in GitHub for the web image build).

## Tooling problems

| When (MT) | Problem | What we did |
| --- | --- | --- |
| 2026-11-09, 3:05 PM | The Dash0 web SDK (0.30.0) has no metrics API, only `sendEvent`, so the phone can't report `roompass.caption.lag` as a metric the way CONTRACT.md says. | The phone sends `sendEvent('roompass.caption.lag', ...)` with the lag as an attribute, and a SignalControl rule turns it into a histogram. Not yet confirmed that web events pass through SignalControl. |
| 2026-11-09, 3:05 PM | Native SLOs use a fixed 28-day window, so the fastest burn alert needs about 2% of the budget in an hour. A 2-minute chaos run may not trip it. | Added a check rule (p95 over 10 s for 30 s) as the alert shown in the demo. |
| 2026-11-09, 3:05 PM | `backend/Dockerfile` sets `OTEL_SDK_DISABLED=true`, so the backend sends nothing until the `otel` Secret overrides it. | The `otel` Secret must set `OTEL_SDK_DISABLED: "false"`. |
| 2026-11-09, 3:09 PM | Gitar on PR #14: `[1m]` rate windows can return no data with a 1-minute SignalControl aggregation. | Taken. Every rate window widened to `[2m]` (dashboard JSON and check rule). |
| 2026-11-09, 4:05 PM | The `otel` Secret created at 3:55 PM had the endpoint, headers and dataset but not `OTEL_SDK_DISABLED: "false"`, so the backend still sent nothing. Found by re-reading the row above while syncing the tool logs. | The Secret script now adds `OTEL_SDK_DISABLED: "false"`. Re-apply the `otel` Secret, restart `backend` and `translator`, then check for `backend` traces in Dash0. |

