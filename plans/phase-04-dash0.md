# Phase 04: Platform lane, Dash0 part

**Goal:** the lag SLO and a pipeline dashboard Miguel can create in Dash0 by hand, plus the chaos demo beat written down.
**Brief requirements covered:** 1 (lag on screen is the user side of the SLO), demo path step 4 (ops with one real incident).
**Depends on:** phase 01 contract (`CONTRACT.md`, "Lag (the Dash0 SLO)" and "Telemetry names").
**Touches only:** `plans/phase-04-dash0.md`, `docs/tools/dash0.md`, `docs/tools/dash0-dashboard.json`

## Checklist

- [x] Read the Dash0 docs: web SDK events, SignalControl, SLOs, dashboards as code
- [x] Pick how the phone's lag becomes a number Dash0 can take a p95 of (SignalControl histogram from the web event)
- [x] Write the SLO definition and the click-by-click steps in `docs/tools/dash0.md`
- [x] Write `docs/tools/dash0-dashboard.json` (Perses): lag p50/p95 with the 10 s line, p95 per pipeline span, `questions.check`, `themes.build`, error rate per span
- [x] Write the chaos demo beat (chaos flag, SLO burn, Agent0, fallback flag)
- [x] List telemetry gaps in other lanes' code for the report (no fixes outside this lane)
- [ ] Miguel: create the SignalControl rule, the SLO, the check rule and import the dashboard in Dash0
- [ ] Miguel: rehearse the chaos beat once real spans and lag events arrive

## Assumptions made

- The web SDK (`@dash0/sdk-web` 0.30.0) has no metrics API. The phone sends lag as a custom event named `roompass.caption.lag` with a numeric attribute `roompass.caption.lag` (seconds) and `talk.id`.
- A Dash0 SignalControl rule turns that event into an exponential histogram metric `roompass.caption.lag`. Not verified that web SDK events go through SignalControl; the doc has a fallback.
- The span name label in PromQL is `otel_span_name`. Not verified; check in the query builder.

## Done when

- [ ] SLO "Caption lag p95 under 10 s" shows data in Dash0
- [ ] Dashboard imported, every panel shows data from a live talk
- [ ] Chaos flag raises lag on the phone and on the dashboard; fallback flag brings it back
- [ ] Waiting for me to say commit
