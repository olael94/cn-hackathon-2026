# Cloud Native Hackathon: Brief

Filled from `docs/RoomPass Brief.md` (Brief v2, Nov 9 2026). That file is the full version; this one is what agents read before a phase. Editing it is "ask first".

**Event:** WeMakeDevs Cloud Native Hackathon, Mon Nov 9 2026, The Shop, Salt Lake City
**Format:** team of 3 · about 5 hours · 5-minute demo
**Tracks:** Merge Forward + Elasticsearch + Dash0 (natural fits), Radar + Gitar (support the story)

## 1. One-line identity

RoomPass gives every room at a conference what only keynotes get today: scan one QR code, no account, and your phone shows live captions in English and Spanish, a catch-up for latecomers, and typed Q&A that tells you if your question was already answered.

## 2. Wow moment

- **What happens:** Miguel speaks English. Our phones show Spanish captions and "live · 1.4s behind". A Spanish question about something said in English comes back "Possibly covered at 12:04" with the English caption line and score. Then the chaos flag (OpenFeature, flagd) slows the translator, the on-screen lag climbs and the SLO burns in Dash0, Agent0 and Radar's AI point at the translator, and the fallback flag brings lag back in seconds.
- **Why it lands:** the lag number on the phone is the user-facing side of the SLO, so the product and the ops story are the same screen. Cross-language matching shows search doing real work, with no generation.
- **How it can fail:** venue Wi-Fi (own hotspot for the audio laptop, phones on cellular, SSE resume from Redis Streams); slow STT or translation (the lag shows it, and it becomes the ops moment); judges' phones (demo runs on our phones, judges scanning is a bonus); everything else: a recorded backup run.

## 3. The problem

Deaf and hard-of-hearing attendees, second-language listeners, and anyone who won't ask out loud lose most of a talk outside the keynote room. Only keynotes get captions. Walk in late and there is no way to catch up. Have a question and you either ask out loud or don't ask.

## 4. The hard part

"The hard part is getting EN and ES captions to a phone fast enough to show an honest lag under 3 seconds, and matching a question in one language against captions in the other."

## 5. Rubric

| Criterion | Weight | How we win it |
|-----------|--------|---------------|
| Makes conferences easier (every track) | High | Captions and Q&A for people the room leaves out today |
| Merge Forward: inclusive and accessible | High | Deaf and hard-of-hearing, second-language, quiet attendees; accessible phone page |
| Elasticsearch: core data layer, smart search | High | Segments, passages, questions live there; hybrid BM25 + semantic cross-language match |
| Dash0: depth of instrumentation, real fix, observability in the product | High | One trace per segment, RUM, lag SLO shown on screen, Agent0 or MCP finds a real issue |
| Radar: runs on K8s, operated through Radar, real AI investigation | Medium | Their cluster, Argo CD deploys, one investigation on a real failure |
| Gitar: PRs reviewed all day, project rules, CI fix | Medium | Every feature is a PR, review rules, one auto-apply fix |
| Best overall: story, polish, depth | High | Person first, tools second |

## 6. Hard requirements

Must ship:

1. **Live captions** in EN and ES, with the lag on screen ("live · 1.4s behind").
2. **Typed Q&A with a soft match.** "Possibly covered at 12:04" plus the caption line, match score and a **Still ask** button. Works across languages: a Spanish question matches English captions. Phones show the top questions, with a filter. Spanish questions show in English on the speaker view.
3. **Speaker link.** Start button, and press-and-hold 3s to stop so a misclick never ends the talk. Questions sorted by votes. One opt-in switch for saving the transcript.
4. **Accessible app.** Font size, high contrast, screen reader labels, one-handed use, and a "machine captions, may contain errors" label.

**Never cut:** captions with lag, Q&A match, the ops story.

## 7. Data

| Source | How we get it | Seeded? |
|--------|---------------|---------|
| Speaker audio | Speaker page mic, PCM16 16 kHz mono over WebSocket | 3-minute test talk recorded at H0 |
| Segments and passages | Pipeline (STT) + translator, into Redis Streams and Elasticsearch | Test talk pre-loaded into the demo room |
| Questions | Phones, typed | About 10 EN/ES pairs + 10 unrelated, for threshold tuning |
| Talks | Speaker link start, opt-in flag | Demo room |

## 8. Scope

**Must have (demo path):** the four requirements in §6.

**Nice to have:** Catch me up: 3 to 5 bullets on the talk so far, each linked to its caption line.

**Out of scope:** follow-a-talk, end-of-talk summary, EN/ES question merge, edge mode, join-code rotation, TTL deletion, chatbot, more than 2 languages, accounts, notifications, schedules, sign language, recordings.

## 9. Demo path

1. **Problem (30s).** "Who here walked into a talk late, or had a question and didn't ask it?"
2. **Captions with lag (1m30s).** Miguel speaks English; our phones show Spanish captions and "live · 1.4s behind". This number is the user-facing side of our SLO.
3. **Q&A match (1m).** In the pre-loaded demo room, type a Spanish question about something said in English. It shows "Possibly covered at 12:04" with the English line and score.
4. **Ops with one real incident (1m30s).** Flip the chaos flag, lag climbs, SLO burns in Dash0, Agent0 and Radar point at the translator, flip the fallback flag, lag recovers. Then the real failure we hit today, with screenshots.
5. **Close (30s).** Rooms are data, cost per talk-hour, what's next.

## 10. AI approach

AI transcribes (OpenAI realtime STT, Moonshine only if captions already work at H1) and translates (OPUS-MT on CTranslate2). It never decides what is true. "Possibly covered" is Elasticsearch search, no generation. Catch-up bullets (stretch, gpt-5.4-mini with structured outputs) must cite existing segment IDs, or code drops them.

## 11. Glossary

- **Segment:** one finished caption line, with `t_start`, `t_end`, `text_en`, `text_es`.
- **Passage:** 15 seconds of captions, the unit for semantic matching.
- **Lag:** phone receive time minus (talk `started_at` + segment `t_end`), corrected with the SSE hello clock offset. SLO: p95 under 3s.
- **Soft match:** "Possibly covered" shown only when keyword and semantic agree, or semantic is above a high threshold.

## 12. Open questions

- Best Overall: does it need every sponsor tool? Check the Rules tab.
- Demo length and Q&A time
- Radar namespace limits for streaming workers
- Similarity thresholds (tune at H4)
- Final name
