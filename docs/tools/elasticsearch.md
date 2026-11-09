# Elasticsearch in RoomPass

Elasticsearch is RoomPass's data layer. Every talk, every caption line and every question lives there, and the "Possibly covered" check on a typed question is a hybrid search over the talk's own captions. There is no other database for live data.

We run Elastic Cloud Serverless. The code is in `backend/roompass/search.py` (data layer and "possibly covered") and `backend/roompass/themes/search.py` (question themes).

## Indices

Created on api startup by `search.setup_indices()`, with the mappings from `CONTRACT.md`.

| Index | One document per | Key fields | Used for |
|---|---|---|---|
| `talks` | talk | `talk_id`, `status`, `started_at`, `speaker_token_hash` | Talk state that survives a pod restart. The speaker token is stored only as a SHA-256 hash. |
| `segments` | caption line (one 5 s audio chunk) | `talk_id`, `seq`, `t_start`, `t_end`, `text_en` (english analyzer), `text_es` (spanish analyzer), `semantic` (`semantic_text`) | Replay when a phone reconnects, first load, "possibly covered", themes |
| `questions` | audience question | `text`, `lang`, `text_en`, `votes`, `voters`, `semantic` (`semantic_text`), `topic_score` | Grouping questions into themes |

`semantic` uses the inference endpoint **`.jina-embeddings-v3`**, a multilingual embedding model hosted by Elastic. We picked it from `GET _inference/_all` on our project. ELSER (`.elser-2-elastic`) was also available, but it is English-only, so a Spanish question could not match an English caption. Elasticsearch embeds the text at index time, so the backend never calls an embedding API itself.

## Where each caption goes

1. The speaker page posts a 5 s audio chunk.
2. OpenAI transcribes it (English) and translates it (Spanish).
3. The backend sends it to every phone over SSE first, then calls `search.index_segment()`, so a slow index never delays a caption.
4. If a phone drops off Wi-Fi, it reconnects with `Last-Event-ID`. The backend replays newer lines from memory first, then from `segments` for anything older, deduplicated by `seq`. Memory comes first because a line can take about a second to become searchable.

## "Possibly covered": hybrid search

`search.check_question(text, talk_id)` runs when someone types a question, before it is posted.

1. **Two searches in parallel** over the talk's `segments`:
   - **Keyword (BM25)** on `text_en` and `text_es`, each with its own language analyzer
   - **Semantic** on `semantic`: the question is embedded with the same multilingual model
2. **Reciprocal rank fusion (RRF)** merges the two rankings: each list adds `1 / (60 + rank)`, so a line found by both searches rises to the top. A tie goes to the line with the higher semantic score.
3. **Plain code decides `covered`**, never a model. The top line counts as covered when it is a keyword hit with a semantic score of at least **0.6**, or when its semantic score alone is at least **0.68**.
4. It returns up to 3 matches (segment id, timestamp, English and Spanish line, score), which the phone shows as "Possibly covered at 12:04" with a **Still ask** button.

The semantic score is Elasticsearch's `_score` for the semantic query, `(1 + cos) / 2`, from 0 to 1. The RRF score is only used to order results: it is about 0.01 to 0.03, so it can't be used as a cutoff (Gitar caught this in PR #6).

## How we tuned the cutoffs

We indexed 5 caption lines in a test talk and asked 8 questions, in English and in Spanish:

| Question | Expected | Covered | Top line | Semantic score |
|---|---|---|---|---|
| ¿Cómo configuro las solicitudes para que funcione el autoescalado? | yes | yes | Autoscaling only helps if your resource requests are set correctly. | 0.813 |
| ¿Qué pasa si mi teléfono pierde la conexión? | yes | yes | When a phone reconnects, it picks up the captions it missed. | 0.757 |
| ¿Cómo miden el retraso de los subtítulos? | yes | yes | We measure delay from the moment a speaker finishes a line ... | 0.690 |
| Do you use GitOps for deployments? | yes | yes | Every deploy goes through Argo CD ... | 0.699 |
| How are questions matched to captions? | yes | yes | Questions are matched against captions with hybrid search ... | 0.871 |
| Where is the coffee and when is lunch? | no | no | | 0.515 |
| ¿Cuál es la mejor pizza de Salt Lake City? | no | no | | 0.501 |
| Do you support Windows Server 2012? | no | no | | 0.584 |

**8 of 8 correct.** Related questions scored 0.69 to 0.81, unrelated ones 0.50 to 0.58. Our first semantic-only cutoff (0.8, a guess) missed "Do you use GitOps for deployments?": it shares no words with the Argo CD line, so it only had its 0.699 semantic score. We moved the cutoff to 0.68, about 0.1 from the highest unrelated score.

Two things the test taught us:
- **Ties happen.** For the Spanish delay question, keyword search ranked the reconnect line first and semantic search ranked the delay line first, so their RRF scores were exactly equal and the order was arbitrary. We added the semantic tie-break.
- **The embedding model has opinions.** For "How do you measure caption latency?" in English, semantic search itself ranks the reconnect line slightly above the delay line, because both talk about captions on phones. It's still marked covered. A reranker would fix the order (see below).

## Question themes (Miguel)

`backend/roompass/themes/` groups on-topic questions so the speaker can answer several at once. It uses Elasticsearch scores only: a question is off topic when its best semantic match against the talk's `segments` is under 0.65, and questions group together at a semantic score of at least 0.75 against each other. A model only writes each theme's label.

## Limits and what's next

- The cutoffs were tuned on 8 questions, not hundreds. A real event would tune them per talk.
- `.jina-reranker-v2-base-multilingual` is available on our project and would reorder the top matches more precisely.
- Translation quality depends on the transcript. A bad transcript gives a bad match.
