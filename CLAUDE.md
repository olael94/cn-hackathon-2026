# Cloud Native Hackathon (WeMakeDevs CNH) – Project Context

> Read this whole file before doing anything. It is the complete context from my planning
> sessions: the event, the rules, the judges, my past winning process, every idea we
> explored, and the execution plan. The final project idea is NOT locked yet (see section 7).

---

## 0. About me and how we work together

- **Name:** Oliver Rivera. Software Engineering student at Ensign College (graduating 2027). Based in Taylorsville, Utah. Bilingual English/Spanish.
- **GitHub:** olael94. **Portfolio:** oliver-rivera-portfolio.vercel.app. **LinkedIn:** linkedin.com/in/oliver-rivera-dev
- **My stack (comfortable):** React/Next.js, Spring Boot, FastAPI, Docker, AWS, GitHub Actions.
- **New to me (all four sponsor tools):** Gitar/Sonar, Dash0/OpenTelemetry, Radar/Kubernetes, Elasticsearch.
- **Competing SOLO.** I won my first hackathon (Ensign BUILD) solo and want to repeat that process.
- **Goals:** win, learn new tech, be realistic about what fits the time window.

### Writing and communication rules
- **Never use em dashes** in anything you write for me (code comments, README, docs, messages).
- Be direct when I'm rushed. Explain new concepts in 1 to 2 sentences, comparing them to React, FastAPI, Spring Boot or Docker.
- Flag uncertainty. If you're not sure, say so and give me a quick test to verify.
- Push back on bad ideas. Raise counterarguments; don't just agree.
- Preserve originality: flag generic or boilerplate naming and copy.
- Never hardcode API keys. Secrets go in `.env` (gitignored before the first commit), with a committed `.env.example`.

### Working agreement (adapted from my winning process, faster for a 6-hour window)
- At Ensign I typed all code myself with Claude guiding. That loop is too slow for ~6 hours.
- **New rule for this event:** I type the core logic and the sponsor integrations (the parts judges will ask me about). Claude applies plumbing, boilerplate, config, Docker and fixes when I say so.
- Edit files only when I explicitly say so, for that change only.
- For code I type: give short plain comments on most lines and mark edits with `// NEW`.
- When I say I'm done typing: diff my code against your tested version (ignore comments/spacing), run it, and name exact fixes.
- Every milestone has a physical "done when" test. Nothing gets built on top of an untested milestone.
- Commit after every working milestone with a detailed message. Commit before every risky experiment so undo is one command.
- If I'm more than 45 minutes behind on a milestone, cut LATER scope, never earlier quality.
- If a feature fails twice near the deadline, cut it and explain the limitation honestly in the demo.
- Describe bugs by exact behavior. Before accepting a diagnosis, propose a small test that separates the possible causes.

---

## 1. The event: key facts

- **Name:** Cloud Native Hackathon, run by WeMakeDevs (founder: Kunal Kushwaha).
- **Page:** https://www.wemakedevs.org/hackathons/cnh (tabs: Overview, /schedule, /resources, /partners)
- **Registration:** https://luma.com/cnh (free)
- **Date:** Monday, November 9, 2026. In person only. Free entry.
- **Theme / tagline:** "Conferences, the easy way." Build anything that makes conferences better.
- **Venue:** The Shop Workspace, 350 E 400 S, Salt Lake City, UT 84111.
- **Capacity:** 170 to 200 people max. They turn people away once full. **Arrive early (target 8:30 AM).**
- No travel or accommodation covered. Teams optional; solo is allowed. Team-finding time at kickoff.
- **Food:** breakfast 10:00 AM, lunch 2:00 PM, coffee all day.
- **Bring:** laptop and charger. Gitar and Dash0 accounts set up beforehand. Docker and a Kubernetes cluster ready if entering Radar or Elasticsearch tracks.
- It runs alongside **KubeCon + CloudNativeCon North America 2026** (Nov 9 to 12, Salt Palace Convention Center, Salt Lake City, 9,000+ attendees).

### Schedule (Mountain Time)
| Time | What |
|---|---|
| 9:00 AM | Check-in and breakfast |
| 10:00 AM | Kickoff and talks |
| 11:00 AM to 2:00 PM | Build time |
| 2:00 PM | Lunch, a panel, more build time |
| **5:30 PM** | **Project submission deadline** |
| 5:30 to 6:30 PM | Project presentations |
| 6:30 to 7:00 PM | Winners announced |
| After 7:00 PM | After-party (House of Kube) |

**Real build window: ~5.5 to 6 hours** (11:00 AM to 5:30 PM minus lunch/panel). About a third of the 15.5 hours I had at Ensign.

**Presentations:** one hour for possibly dozens of teams. Assume a demo of **1 to 2 minutes**, not 4.

---

## 2. Prizes and tracks ($20,000 pool)

You can enter multiple tracks at once. A project enters every sponsor track whose tool it genuinely uses, plus Merge Forward. Every project competes for best overall.

| Prize | For |
|---|---|
| **NVIDIA DGX Spark** (personal AI supercomputer) | Best project overall, any track |
| **$4,000 cash** | Track 1: Sonar / Gitar, "Never Merge Broken" (AI code review) |
| **$4,000 cash** | Track 2: Dash0, "Stop Flying Blind" (observability) |
| **$4,000 cash** | Track 3: Radar, "AI SRE" (Kubernetes UI) |
| **$4,000 cash** | Track 4: Elasticsearch, "Find the Right Talk" (search + vector DB) |
| **iPad** | Merge Forward track: "Conferences for Everyone" (most inclusive/accessible project) |
| Signed *Kubernetes: Up & Running* (by Kelsey Hightower) | Top 10 teams |
| Keychron keyboard, $50 OpenAI credits, swag, certificate | Everyone who attends in person |

---

## 3. Judging criteria (by track)

**Every track also scores: how well the project makes conferences easier.**

### Track 1: Sonar / Gitar (Never Merge Broken)
- Gitar is part of HOW you built: features land through PRs it reviewed all day, not one PR at the end.
- Project-aware setup: review instructions and repository rules that reflect how you actually work.
- Using CI failure diagnosis and auto-apply to fix real problems.

### Track 2: Dash0 (Stop Flying Blind)
- Depth of instrumentation: traces, logs, metrics, and real-user monitoring if there's a frontend.
- Using Agent0 or the Dash0 MCP server to find and fix something REAL during the day, shown in the demo.
- Observability as part of the product experience, not bolted on at the end.
- Bonus: a dashboard or SLO showing app health.

### Track 3: Radar (AI SRE)
- App runs on Kubernetes with Radar connected (own cluster or a namespace they provide). Operated via Radar's MCP server and UI.
- Production ready: GitOps deploys, autoscaling, canary or blue-green rollout, fixing what Radar's audit flags.
- Radar used throughout: agent deploys, debugs, triggers rollouts, checks audits through Radar's MCP.
- Using Radar's AI SRE to find and fix something real during the day, shown in the demo.
- **My assessment: steepest learning curve. Probably skip for a 6-hour solo build.**

### Track 4: Elasticsearch (Find the Right Talk)
- Elasticsearch is the CORE data layer, not a side feature.
- Smart use of search: keyword, semantic, vector or hybrid.

### Merge Forward and Best Overall
- No published rubric. Merge Forward = more inclusive and accessible conferences.
- Best overall will likely reward story + polish + depth across tools.

### NOT stated anywhere (verify at kickoff or in Discord)
- Whether pre-written code is allowed. **Assume NO: only hello-world toolchain tests were done in advance.**
- Submission format (repo link? form? video?).
- AI-tool disclosure rules.
- Exact demo length.

---

## 4. Judges

- **Kelsey Hightower:** Distinguished Engineer (retired) at Google Cloud, co-founder of KubeCon
- **Wes Novack:** SVP, Engineering
- **Joseph Sandoval:** Principal PM at Adobe, Vice Chair of CNCF End User Technical Advisory Board
- **Saiyam Pathak:** Founder of Kubesimplify, CNCF Ambassador
- **Phil Estes:** Principal Engineer at AWS
- **Jacquie Capur:** Developer Relations at Nebius
- **Tomás Martín Barreiro Iffernet:** Software Engineer at Cline
- **Simon Schrottner:** Fractional Developer Advocate at Flagsmith
- **Julia Furst Morgado:** Principal Developer Relations Engineer at Dash0
- **Justin Garrison:** Field CTO at Sidero Labs
- **Nadav Erell:** CEO at Skyhook Radar
- **Kunal Kushwaha:** Founder, WeMakeDevs

Many judges are KubeCon speakers, maintainers and DevRel people. They have personally lived conference pains (full rooms, lines, hallway networking).

---

## 5. Sponsor tools: what they are, resources, setup

### Gitar (Sonar): AI code review
- GitHub App on your repo. Reviews every PR against your conventions, generates fixes, diagnoses CI failures. With auto-apply on, it commits fixes and iterates against the pipeline.
- Review instructions live in: `.gitar/review/`
- Free 14-day Gitar Pro trial, no credit card, includes auto-apply and custom rules. Runs in browser, nothing to install locally.
- Website idea list: schedule builder via Gitar-reviewed PRs with time zone review rules; repo rule that checks frontend still matches API when API changes; break CI on purpose and let auto-apply fix it live in the demo.
- Links:
  - https://www.sonarsource.com/resources/library/get-started-with-gitar/
  - https://docs.gitar.ai/quickstart
  - https://docs.gitar.ai/introduction
  - https://www.sonarsource.com/resources/library/gitar-context-ingestion-for-project-aware-code-reviews/
  - https://www.sonarsource.com/resources/library/multilayered-code-verification-with-gitar-sonarqube-cloud/
  - https://www.sonarsource.com/resources/library/scale-gitar-context-across-an-organization/

### Dash0: observability built on OpenTelemetry
- Logs, metrics, traces, profiles and real-user monitoring in one place. **Agent0** = AI SRE agent you ask in plain English; it finds root causes and can open a PR with the fix. **MCP server** lets Claude Code/Cursor read live traces and logs.
- Recommended flow: point OpenTelemetry auto-instrumentation at the app in the first hour; requests show up in Dash0 within minutes.
- Features to use: Agent0, Dash0 MCP. Bonus: Dash0 CLI, dashboards, alerts, synthetic monitoring. OpenLIT for tracing LLM calls (tokens, cost).
- Website idea list: self-diagnosing multi-service app with a "chaos" button; live crowd map from check-ins; schedule app where Agent0 explains why "My agenda" slowed after the keynote; attendee AI assistant traced with OpenLIT.
- Links:
  - https://www.dash0.com/sign-up
  - https://www.dash0.com/lp/opentelemetry-for-dummies
  - https://www.dash0.com/docs/dash0
  - https://www.dash0.com/hub/integrations
  - https://www.dash0.com/hub/integrations/int_opentelemetry-demo/overview
  - https://www.dash0.com/agent0
  - https://dash0.com/docs/dash0/ai/mcp
  - https://dash0.com/docs/dash0/miscellaneous/tooling/dash0-cli/quickstart
  - https://dash0.com/guides/website-monitoring-with-opentelemetry-and-dash0
  - https://www.dash0.com/docs/dash0/monitoring/kubernetes/dash0-operator/overview

### Radar (Skyhook): open-source Kubernetes UI + AI SRE
- Shows everything in the cluster; AI SRE finds root causes from the UI or from a coding agent via MCP.
- Install: `curl -fsSL https://get.radarhq.io | sh && kubectl radar`
- Needs a cluster: cloud, or local with kind, k3d or minikube.
- Website idea list (on Kubernetes): talk picker that reads your GitHub and reshuffles when a room fills; hallway track matchmaker; live crowd map.
- Links: https://github.com/skyhook-io/radar, https://radarhq.io/docs, https://radarhq.io/docs/install, https://radarhq.io/product/ai-investigations, https://radarhq.io/docs/features/mcp, https://radarhq.io/community/chat

### Elasticsearch: search engine + vector database
- Search by keyword, by meaning (vector), or both (hybrid). Can be the DB behind search, recommendations and RAG.
- Run locally (needs Docker; Elasticsearch + Kibana, all features unlocked for a month): `curl -fsSL https://elastic.co/start-local | sh`
- Or a free Elastic Cloud trial. Query from Python, JavaScript or any client.
- Website idea list: talk search that finds "eBPF and security" sessions even without those words in the title; vector hallway matchmaker; RAG conference assistant over all talk abstracts.
- Links: https://github.com/elastic/start-local, https://www.elastic.co/docs/solutions/search/get-started, https://github.com/elastic/elasticsearch

### OpenAI
- $50 in OpenAI credits for every participant. Usable for transcription, summaries, embeddings.
- **Verify current model names in the OpenAI docs before coding** (transcription and embedding models). I was not certain which names are current.

### Pattern to exploit
A schedule/agenda app is suggested by three sponsors (Sonar, Dash0, Radar). Crowd maps by two. Matchmakers by two. One app can legitimately enter multiple tracks. But sponsor-suggested ideas will be crowded.

---

## 6. Community partners and after-party

- **Merge Forward:** CNCF community group, home to seven diversity groups (https://ocgroups.dev/cncf/group/merge-forward)
- **Kubesimplify:** free Kubernetes and AI infra learning (Saiyam Pathak)
- **Conference Parties:** unofficial lists of conference/vendor parties around big tech events
- **Forge Utah:** Utah volunteer-run engineering community
- **Platform Engineering:** platform engineering community; presents the after-party
- **Fraiday Labs:** local AI hub, meetups every other Friday
- **After-party: House of Kube**, same night after winners. Free, no KubeCon ticket needed. Invite-only signup on Luma (https://luma.com/9p2oc1k5).

### Career context
- KubeCon has no career fair, but many companies hire. Offers often come from conversations at sponsored happy hours and co-located events (per a Reddit anecdote from KubeCon Detroit 2022).
- KubeCon itself needs a paid ticket; the hackathon and House of Kube do not.
- I'm actively job searching. The judges (Kelsey Hightower, AWS principal engineer, an SVP of Engineering, DevRel leads) are a major networking opportunity. Plan: bring business cards or a LinkedIn/portfolio QR code, have my Ensign win story ready, connect with judges afterward.

---

## 7. Idea exploration (status: NOT LOCKED)

### My personal pain points (the authentic story material)
1. Not knowing how long before an event to start lining up, or whether a line is already too big so I should pivot to another worthwhile talk. (From SHPE convention.)
2. Too many sessions to choose from, rooms far apart: if my first choice is full, I don't have time to reach the backup and end up missing both.
3. No table to take notes during talks, just my chair and my phone, trying to catch up on what's being said. Wanted record + transcript + editable summary.
4. Networking/hiring at conferences happens in hallway conversations and is hard to track.

### The bar I set
"Innovative, something no one else has done, and it makes sense." The target judge reaction is the one I got at Ensign: *"Why don't we already have this on our phones? It makes so much sense."*

**Formula that produced that reaction:** something everyone already has in one context, missing in another. (TouchSight: canes guide your feet; nothing guided your finger.)

### LEADING CANDIDATE: Rewind button for live talks (I said I like this one)
- **Gap:** Zoom/Teams meetings have AI "catch me up" features (verify for the pitch). TV has rewind. People sitting in a live talk have nothing. You zone out, check Slack, or miss a term, and it's gone.
- **Product:** open the app when a talk starts. Tap **"What did I just miss?"** for the last ~60 seconds in two lines. Tap **"What does that mean?"** on any term. At the end: a full summary you can edit (fix what the summary missed that mattered to you). Spanish at any point.
- **Absorbs my other pains:** no table for notes, missed talks, beginner jargon, non-native speakers.
- **Tracks:**
  - Elasticsearch (primary): live transcript indexed in chunks as it happens; every "catch me up" and "what does that mean" is a search over it (hybrid/vector).
  - Dash0: real-time pipeline (audio → transcript → index → answer) instrumented end to end; show spoken-word-to-searchable latency; Agent0 used on a real slowdown during the day.
  - Merge Forward: hard-of-hearing and non-native attendees benefit first (captions, Spanish).
- **Wow moment:** during my demo, a judge glances away while I talk, then taps "What did I just miss?" and reads back what I just said.
- **Risks:** live transcription in a noisy room (keep a backup recording); prior art check needed (meeting tools, live caption apps); consent for recording speakers (keep raw audio private; share only summaries).

### Other strong candidates
- **Scan me back:** vendors can scan your badge, but you can't scan theirs or another attendee's. Scan anyone's badge, add a 10-second voice note about the conversation, search later ("the person working on GPU scheduling"), draft follow-ups. Elasticsearch + Dash0. Ties to my job search.
- **Waze for conferences:** one-tap crowd reports ("room 4 full," "coffee out," "Wi-Fi dead here") that expire after a few minutes. Crowdsourcing solves the missing-data problem of crowd maps.
- **Back Row (shared talk capture):** record a talk, transcript + editable summary, and everyone's captures form a searchable memory of the conference, including talks you missed. Elasticsearch core.
- **Q&A Merge:** live question queue that merges duplicate questions by meaning (Elasticsearch vectors); speaker sees "asked by 14 people." Demo: judges submit questions live via QR code. Risk: "Slido with AI."
- **Plan B / reachable backups:** schedule planner where your backup talk is physically reachable if your first choice fills.
- **Agenda That Survives the Keynote:** sponsor-suggested schedule app instrumented with Dash0, chaos button, Agent0 fix, Gitar PRs. Hits many judging bullets but crowded territory.

### Ideas considered and deprioritized (with reasons)
- Live crowd map, talk search/recommender, hallway matchmaker, generic RAG chatbot: on sponsor idea lists, many teams will build them.
- Keynote Spike / Demo Gods / Workshop Rescue: great Dash0+Radar fit, but Radar is too steep solo in 6 hours.
- Slide Snap / copy from slide: iPhone Live Text already does part of it.
- Hiring Map: no real data source; KubeCon expo needs a paid ticket.
- Schedule-as-Code (Gitar-native): very rare but weak relatability.
- CFP Twins, Rehearsal Coach, Trip Report, Hallway Translator, Quiet Route, Afterparty Router, Contribution Matchmaker, Continue Watching, Focus mode for talks, Virtual line, Icebreaker Cards, Story Coach, First-Timer Buddy, Fuzzy Recall, Caption Wall, Jargon Decoder, Line Whisperer: explored, each weaker on either originality, sponsor fit, data, or 6-hour feasibility.

### Decision criteria (adapted idea filter)
- [ ] Makes a real conference pain easier (and I can tell it as my own story)
- [ ] Passes "why not just use iPhone Notes / an AI chat?"
- [ ] Uses 2 sponsor tools DEEPLY (not 4 shallowly); judges punish "bolted on at the end"
- [ ] Has a live wow moment a judge can try (ideally "break it, AI fixes it" or judge interaction)
- [ ] Buildable solo in ~6 hours with toolchain already proven
- [ ] Optional accessibility angle for Merge Forward
- [ ] Explainable in one sentence, demoable in 90 seconds
- [ ] Prior art checked; "how is this different" answer ready

**Claude Code: if the idea is still not locked when we start, help me decide in under 10 minutes using these criteria. Do not reopen brainstorming.**

---

## 8. Execution plan (template, shown for the Rewind button; adapt if the idea changes)

### Stack (all in my comfort zone)
- **Frontend:** Next.js mobile web page. Browser audio capture (MediaRecorder / Web Audio). Must work on my phone.
- **Backend:** FastAPI (Python).
- **AI:** OpenAI for transcription, summaries, term explanations, embeddings (verify current models).
- **Data:** Elasticsearch via Docker (start-local). Transcript chunks with timestamps + embeddings; hybrid search.
- **Observability:** OpenTelemetry auto-instrumentation for FastAPI and Next.js, exported to Dash0. OpenLIT for LLM call tracing. Real-user monitoring on the frontend.
- **Infra:** Docker Compose for everything. Skip Kubernetes/Radar unless ahead of schedule.
- **Gitar (optional):** only if shipping features as PRs doesn't slow me down. If used, it must be used all day, not at the end.

### Data model idea (Rewind)
- `talks` index: talk id, title, speaker, room, start time.
- `chunks` index: talk id, chunk text, start/end timestamp (seconds), embedding vector, language.
- `summaries`: talk id, AI summary, user-edited summary, edit history.
- "What did I just miss?" = fetch chunks for last N seconds → summarize.
- "What does that mean?" = term lookup in chunk context (+ optional glossary) → explain.
- "Ask the talk" = hybrid search over chunks → answer with quote + timestamp.

### Milestones (Monday)
| Target | Milestone | Done when (physical test) |
|---|---|---|
| 11:00 | Scaffold + telemetry | A request from my phone shows up as a trace in Dash0 |
| 11:45 | Audio to transcript | 30 s recorded on my phone appears as timestamped chunks in Elasticsearch (check in Kibana) |
| 12:45 | "What did I just miss?" | Tap returns a 2-line summary of the last 60 s |
| 1:30 | "What does that mean?" + end summary with editing | Edited summary saves and reloads |
| 2:00 | Lunch (eat at laptop) | |
| 2:30 | Hybrid "ask the talk" with quote + timestamp; seed demo talk | Question returns correct quote and timestamp |
| 3:45 | Spanish toggle + Dash0 dashboard/SLO + capture a real Agent0 fix | Toggle works; dashboard shows health; Agent0 fix documented |
| **4:30** | **FEATURE FREEZE** | |
| 4:30 to 5:30 | README, rehearse, backup video, submit | Submitted before 5:30 |

**Cut order if late (>45 min):** Spanish → dashboard → term explanations. Never cut the core "catch me up" loop or Elasticsearch as the data layer.

### Demo script (target 90 seconds)
1. **Story (15 s):** "At SHPE I had no table, just my chair and my phone. Zone out for 30 seconds in a talk and it's gone. Zoom has 'catch me up.' Live talks don't."
2. **Live wow (30 s):** I talk; a judge looks away, then taps "What did I just miss?" and reads it back. Tap a term for an explanation. Toggle Spanish.
3. **Under the hood (30 s):** Elasticsearch: live chunks + hybrid search. Dash0: trace of that exact request, plus the real bug Agent0 found and fixed today.
4. **Close (15 s):** who it helps (hard of hearing, non-native speakers, first-timers, everyone who checked Slack) and next steps.

**Fallbacks:** pre-recorded demo audio clip, pre-seeded transcript, backup video.

---

## 9. My winning process from Ensign BUILD (condensed playbook)

- **Event:** Ensign BUILD, Oct 9 to 10, 2026, solo. Won Technical Solution category.
- **Project:** TouchSight, native iOS app (Swift, ARKit, LiDAR, Vision hand pose, Claude vision + planner) that guides a blind user's fingertip to the right button on flat panels.
- **What worked:**
  - Reading the rubric early and optimizing for it.
  - Type, verify, test, commit loop. Test-compiling every milestone first.
  - Small commits; reverts took one command.
  - Testing on the real device at every milestone.
  - A cloud AI backup when the on-device approach failed.
  - Asking people at the event which categories were crowded (my inference was wrong; asking was right).
  - Unforgettable live demo (blindfolded), honest about limitations.
- **What went wrong:**
  - Setup cost 85 minutes (toolchain, signing, device). **Biggest lesson: prove the toolchain before the event.**
  - A late feature burned an hour and was fully reverted.
  - Debugging went in circles until I described the exact behavior.
- **After:** LinkedIn post, thanked judges by name, connected with them.
- **Warning from that playbook:** that rubric ignored pitch and originality. THIS event judges "makes conferences easier," so story and problem relevance matter here.

---

## 10. Day-of checklist

### Before leaving home
- [ ] Repo created (folder name suggestion: `cnh-2026`, rename once the idea is locked)
- [ ] `.env` in `.gitignore` before the first commit; `.env.example` committed
- [ ] Dash0 account + token; Gitar installed on the repo (if used); OpenAI key with credits
- [ ] Docker images pre-pulled (Elasticsearch, Kibana, anything else). Venue Wi-Fi will be slow.
- [ ] Phone browser audio recording tested
- [ ] Laptop + charger + phone charger + business cards / LinkedIn QR
- [ ] Signed up for House of Kube on Luma

### At the venue
- [ ] Arrive ~8:30 AM (capacity 170 to 200, no entry when full)
- [ ] At kickoff, confirm: pre-written code rules, submission format, demo length, AI disclosure
- [ ] Ask other hackers what they're building and which tracks look crowded
- [ ] Note the presentation order

### Final hour
- [ ] README: inspiration, how it works, setup, sponsor tools used and how, AI disclosure, limitations
- [ ] Repo public, checked in a private browser window
- [ ] Demo tested from a fresh launch, fallbacks ready
- [ ] Short project summary ready for the submission form
- [ ] Submitted before 5:30 PM

---

## 11. Open questions / uncertainties
- Final idea not locked (leading: Rewind button).
- Pre-written code allowed? Submission format? Demo length? AI disclosure required?
- Current OpenAI model names for transcription and embeddings.
- Prior art for "catch me up" in live in-person talks.
- Exact Keychron model given away (estimated ~$70 to $100 value, 65% layout, white with red accents).
