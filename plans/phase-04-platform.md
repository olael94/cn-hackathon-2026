# Phase 04: Platform manifests

**Goal:** translator and flagd run in the cluster so the chaos demo can point at them by name.
**Brief requirements covered:** ops story (brief §9 step 4), captions with lag (lag SLO p95 under 10 s)
**Depends on:** phase 00 (images and CI)
**Touches only:** `deploy/`, `plans/`

## Checklist

- [x] `deploy/translator.yaml`: Deployment + Service `translator`, image `backend`, replicas 1
- [x] `deploy/flagd.yaml`: ConfigMap with `translator-chaos-delay-ms` (0, on 4000) and `translator-fallback` (false, on true), Deployment `ghcr.io/open-feature/flagd:v0.18.2`, Service `flagd` (8013 gRPC, 8016 OFREP)
- [x] `deploy/backend.yaml`: `TRANSLATOR_URL`, `FLAGD_HOST`, `FLAGD_PORT`, optional `openai` and `elastic` secretRefs
- [x] Translator gets the same secretRefs and flagd env
- [x] Add both files to `deploy/kustomization.yaml` resources
- [x] Requests stay inside 2 CPU / 4 GiB
- [x] `kubectl kustomize deploy` builds
- [ ] Secrets `openai` and `elastic` created by hand in the namespace (outside git)
- [ ] Swap translator command to `python -m roompass translator` once phase 02 builds it

## Assumptions made

- Redis is dropped; missed captions replay from Elasticsearch.
- `python -m roompass translator` exits today, so the translator pod runs the api process as a placeholder until phase 02 lands. It keeps the pod healthy and the Service name live.
- Translator listens on port 8000 like the api; Service port 80.
- Redis, Dash0 dashboards, SLO and Gitar rules are separate pieces of this lane.

## Done when

- [ ] Argo CD synced, translator and flagd pods healthy in Radar
- [ ] Public URL still shows the backend health card
- [ ] Report written: what you clicked, what you saw
