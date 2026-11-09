# Captions Path (Protects the Lag SLO)

Audio chunk to caption on a phone must stay under 10 s at p95. That number is the Dash0 SLO and the demo.

- No blocking calls on the FastAPI event loop. Use the async OpenAI and Elasticsearch clients, or `asyncio.to_thread` for anything synchronous. Flag `time.sleep`, sync HTTP clients or sync Elasticsearch calls inside `async def`.
- Chunks for one talk are processed in `seq` order. Flag changes that could publish segment 13 before segment 12.
- Publish the segment to SSE before or alongside indexing, never after a slow step that isn't needed for display.
- Each stage keeps its span: `pipeline.transcribe`, `pipeline.translate`, `pipeline.index`, `pipeline.publish`, with `talk.id` and `segment.seq`. Flag a PR that removes or renames one; Dash0 dashboards depend on those names.
- SSE: every stream sends `hello` first, a `: ping` comment every 15 s, and `id: <seq>` on segment events so `Last-Event-ID` resume works. Flag changes that break resume.
- The phone keeps showing captions when catch-up or Q&A fail. Errors in those features must not close the SSE stream.
