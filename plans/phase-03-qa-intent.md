# Phase 03 · Audience questions and the speaker brief

## Rehearse with two phones

Open `/?room=demoen` on both phones and `/speaker?room=demoen` on the speaker's screen. All three devices must use the same server and room code. For a fresh queue, choose another six-character code made of lowercase letters or digits. The rehearsal starts with English captions, sample questions, and speaker notes.

| Time | On the device | On the speaker screen |
|---|---|---|
| 0–20 s | On phone 1, open **Q&A → Ask a question → Question options → Use sample question → Send question**. Read the quote at 12:04 and select **Still ask**. | Recovery moves from one supporter to two. Delay also has two and stays first because it was asked earlier. |
| 20–40 s | On phone 2, choose **Question options → Use sample follow-up → Send question**. The attendee asks how much history they can recover after twenty minutes. | Recovery moves into first place with three supporters. The new detail appears under it. |
| 40–60 s | Open **Speaker brief** on the recovery question. | The speaker sees the audience's question, the exact caption about reconnecting, and the open question about how far back recovery goes. |

After the rehearsal, try “How much mobile data does recovery use?” by sending it as a new draft. The service checks whether it belongs with an existing question. Try “Where can I find tomorrow’s schedule?” to exercise independent publication. Supporting the twenty-minute follow-up from phone 1 adds a vote to that detail while keeping the group's total at three.

## Run it on the local network

In `backend/`, run `uv run --env-file ../.env uvicorn roompass.api:app --host 127.0.0.1 --port 8000`. In `web/`, run `pnpm build`, then `pnpm preview --host 0.0.0.0`. Open the Network address printed by Vite on both phones. The speaker can open the brief before starting the microphone.

A single backend replica stores contributions in SQLite. Set `ROOMPASS_DEMO_DB` to choose the database file. With `ES_URL` and `ES_API_KEY` set, run `uv run --env-file ../.env python -m roompass.qa_search` from `backend/` to seed the two replay passages in the dedicated `roompass-demo-qa-v1` index. Elasticsearch runs a keyword search over the passages. The replay can also show a seeded citation when the service is unavailable.

Set `ROOMPASS_QA_DECISIONS=1` and `OPENAI_API_KEY` in the private backend environment for AI routing. The server checks up to eight room questions or follow-ups against the draft, including candidates with different wording. It asks whether a retrieved caption answers the specific detail. It caches repeated decisions and allows up to 30 external calls per run. [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions)

## Submitting a question

Attendees type a question and press **Send question**. If a visible caption may answer it, the attendee can close the draft with **This answers it**, or continue with **Still ask**. Otherwise the service submits immediately. A receipt explains the result.

| Relationship | Queue update |
|---|---|
| The same answer resolves both questions. | Count support for the matching question or follow-up. |
| The draft asks for a new condition, limit or example. | Attach the original wording as a follow-up to the relevant group. |
| The relationship is weak or the topic is new. | Publish independently. |

Without a model response the server recognizes identical questions and the two rehearsal examples. It publishes uncertain drafts independently. Reading a citation or closing the draft contributes zero votes.

## Ranking and the speaker brief

Count one anonymous device per group, including people who ask, support or expand it. Rank groups by that count, then by age. Within a group, sort follow-ups by their own distinct supporters, with the older follow-up first in a tie. The API handles concurrent submissions and retries so the same action counts once.

| Brief field | Example after the second phone submits |
|---|---|
| Asked by the room | “Do captions catch up when I reconnect?” · 3 supporters |
| Already discussed | “When a phone reconnects, it picks up the captions it missed.” · 12:04 |
| What to clarify | “If I reconnect after twenty minutes, how much caption history can I recover?” |

The brief uses the original question, the cited caption, and the most supported follow-up. The speaker can expand other submitted wordings. When no citation is available, the card says **No caption reference found**.

## Next steps for live talks

- Connect retrieval to the live talk's passages and questions. Calibrate thresholds on paraphrases, requests for an extra detail, and questions that share only a topic.
- Index presenter materials shared with the audience and cite the page or slide. Refresh evidence when a later caption addresses a queued question.
- Keep outstanding follow-ups visible after the speaker answers the main question and rank the group by the remaining demand.
- Evaluate cross-language grouping and a generated brief that cites only verified source passages. Fall back to the template when citations are missing. See the [project brief](../brief/brief.md) and [AI rules](../.claude/rules/ai.md).
