# Cloud Native Hackathon: Brief

Cut-down version of `docs/RoomPass Brief.md` for the time we have. **`CONTRACT.md` wins wherever the two disagree.** This file is what agents read before a phase. Editing it is "ask first".

**Event:** WeMakeDevs Cloud Native Hackathon, Mon Nov 9 2026, The Shop, Salt Lake City
**Format:** team of 3 · build until 4:45 PM, submit by 5:30 PM · 5-minute demo (confirm)
**Tracks:** Merge Forward + Elasticsearch + Dash0 (natural fits), Radar + Gitar (support the story)

## 1. One-line identity

RoomPass gives every room at a conference what only keynotes get today: scan one QR code, no account, and your phone shows live captions in English and Spanish, a catch-up for latecomers, and typed Q&A that tells you if your question was already answered.

## 2. Wow moment

- **What happens:** Miguel speaks English. Our phones show Spanish captions and "live · 6.2s behind". A Spanish question about something said in English comes back "Possibly covered at 12:04" with the English caption line and score. Then Dash0 shows the trace of that exact caption, audio to phone, and the lag SLO.
- **Why it lands:** the lag number on the phone is the user-facing side of the SLO, so the product and the ops story are the same screen. Cross-language matching shows search doing real work, with no generation.
- **How it can fail:** venue Wi-Fi (own hotspot for the audio laptop, phones on cellular, SSE resume from the in-memory buffer and Elasticsearch); slow transcription or translation (the lag shows it); judges' phones (demo runs on our phones, judges scanning is a bonus); everything else: a recorded backup run.

## 3. The problem

Deaf and hard-of-hearing attendees, second-language listeners, and anyone who won't ask out loud lose most of a talk outside the keynote room. Only keynotes get captions. Walk in late and there is no way to catch up. Have a question and you either ask out loud or don't ask.

## 4. The hard part

"The hard part is getting EN and ES captions to a phone with an honest lag on screen, and matching a question in one language against captions in the other."

## 5. Rubric

| Criterion | Weight | How we win it |
|-----------|--------|---------------|
| Makes conferences easier (every track) | High | Captions and Q&A for people the room leaves out today |
| Merge Forward: inclusive and accessible | High | Deaf and hard-of-hearing, second-language, quiet attendees; accessible phone page |
| Elasticsearch: core data layer, smart search | High | Talks, segments and questions live there; hybrid BM25 + semantic cross-language match |
| Dash0: depth of instrumentation, real fix, observability in the product | High | One trace per segment, RUM, lag SLO shown on screen, Agent0 or MCP finds a real issue |
| Radar: runs on K8s, operated through Radar, real AI investigation | Medium | Their cluster, Argo CD deploys, one investigation on a real failure |
| Gitar: PRs reviewed all day, project rules, CI fix | Medium | Every feature is a PR, review rules, one auto-apply fix |
| Best overall: story, polish, depth | High | Person first, tools second |

## 6. Hard requirements

Must ship:

1. **Live captions** in EN and ES, with the lag on screen ("live · 6.2s behind").
2. **Typed Q&A with a soft match.** "Possibly covered at 12:04" plus the caption line, match score and a **Still ask** button. Works across languages: a Spanish question matches English captions. Phones show the top questions. Spanish questions show in English on the speaker view.
3. **Speaker link.** Start button, and press-and-hold 3s to stop so a misclick never ends the talk. Questions sorted by votes.
4. **Accessible app.** Font size, high contrast, screen reader labels, one-handed use, and a "machine captions, may contain errors" label.

**Never cut:** captions with lag, Q&A match, the Dash0 and Radar story.

## 7. Data

| Source | How we get it | Seeded? |
|--------|---------------|---------|
| Speaker audio | Speaker page mic, 5 s webm/opus chunks over HTTP POST (`CONTRACT.md`, Audio chunks) | 3-minute test talk recorded early |
| Segments | api: OpenAI transcription, then OpenAI translation, into Elasticsearch and the in-memory SSE buffer | Test talk pre-loaded into the demo room |
| Questions | Phones, typed | About 10 EN/ES pairs + 10 unrelated, for threshold tuning |
| Talks | Speaker link start | Demo room |

## 8. Scope

**Must have (demo path):** the four requirements in §6.

**Nice to have:** Catch me up: 3 to 5 bullets on the talk so far, each linked to its caption line. Question filter on phones.

**Out of scope:** Redis, flagd and the chaos flag, OPUS-MT and Moonshine, WebSocket audio, 15 s passages, transcript opt-in switch, follow-a-talk, end-of-talk summary, EN/ES question merge, edge mode, join-code rotation, TTL deletion, chatbot, more than 2 languages, accounts, notifications, schedules, sign language, recordings.

## 9. Demo path

1. **Problem (30s).** "Who here walked into a talk late, or had a question and didn't ask it?"
2. **Captions with lag (1m30s).** Miguel speaks English; our phones show Spanish captions and "live · 6.2s behind". This number is the user-facing side of our SLO.
3. **Q&A match (1m).** In the pre-loaded demo room, type a Spanish question about something said in English. It shows "Possibly covered at 12:04" with the English line and score.
4. **Ops with one real incident (1m30s).** Dash0: the trace of one caption from audio to phone, and the lag SLO. Then the real failure we hit today: what Agent0 or Radar's AI investigation found, and the PR that fixed it.
5. **Close (30s).** Rooms are data, cost per talk-hour, what's next (Redis for more replicas, streaming audio for lower lag, more languages).

## 10. AI approach

AI transcribes and translates, both with OpenAI models (check exact names in the OpenAI dashboard). It never decides what is true. "Possibly covered" is Elasticsearch search, no generation. Catch-up bullets (stretch, structured outputs) must cite existing segment IDs, or code drops them.

## 11. Glossary

- **Segment:** one finished caption line from one 5 s audio chunk, with `t_start`, `t_end`, `text_en`, `text_es`. Also the unit for semantic matching.
- **Lag:** phone receive time minus (talk `started_at` + segment `t_end`), corrected with the SSE hello clock offset. SLO: p95 under 10 s.
- **Soft match:** "Possibly covered" shown only when the top match is a keyword hit with a semantic score of at least 0.6, or has a semantic score of at least 0.8 (`CONTRACT.md`).

## 12. Open questions

- Best Overall: does it need every sponsor tool? Check the Rules tab.
- Demo length and Q&A time
- Similarity thresholds (tune on the seeded pairs)
