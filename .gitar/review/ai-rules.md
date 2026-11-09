# AI Transcribes and Translates. It Never Decides What Is True.

The model sits at the edges: audio to text, English to Spanish, caption lines to catch-up bullets. Plain code decides everything else.

- Catch-up bullets must carry `segment_ids`, and the citation validator must run before any bullet is returned or cached. Flag any code path that returns model output without it.
- The validator drops a bullet whose `segment_ids` is empty or cites an id that does not exist for that talk. Flag changes that loosen this.
- "Possibly covered" (`covered`, `matches`, `score`) must come from Elasticsearch scores and fixed thresholds in code. Flag any LLM call in the question matching path.
- Model output is parsed into a pydantic model before use. Invalid output: retry once, then return a friendly error.
- Every OpenAI call has a timeout and an error path. A failed translation sends the segment with `text_es: null` instead of dropping it, so captions keep flowing.
- Prompts live in `backend/prompts.py`, not inline in logic.
- Model names come from config or env vars, not string literals scattered through the code.
