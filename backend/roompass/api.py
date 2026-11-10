import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from roompass.contract import Health, ThemeSet
from roompass.demo_questions import router as demo_questions
from roompass.demo_replay import router as demo_replay

voice_enabled = all(os.getenv(key) for key in ("OPENAI_API_KEY", "ES_URL", "ES_API_KEY"))
if voice_enabled:
    from roompass import pipeline, search
    from roompass.themes import on_themes
    from roompass.themes import router as themes_router

logging.basicConfig(level=logging.INFO)
version = os.environ.get("APP_VERSION", "dev")


async def push_themes(theme_set: ThemeSet) -> None:
    """Send each rebuilt ThemeSet to the talk's phones as the `themes` SSE event."""
    await pipeline.publish_event(theme_set.talk_id, "themes", theme_set.model_dump(mode="json"))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if voice_enabled:
        await search.setup_indices()
        on_themes(push_themes)
    yield
    if voice_enabled:
        await search.es.close()


app = FastAPI(title="RoomPass api", lifespan=lifespan)
app.include_router(demo_questions)
app.include_router(demo_replay)
if voice_enabled:
    app.include_router(pipeline.router)
    app.include_router(themes_router)


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
