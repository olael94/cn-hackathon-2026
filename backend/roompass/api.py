import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from roompass import pipeline, search
from roompass.contract import Health, ThemeSet
from roompass.themes import on_themes
from roompass.themes import router as themes_router

logging.basicConfig(level=logging.INFO)
version = os.environ.get("APP_VERSION", "dev")


async def push_themes(theme_set: ThemeSet) -> None:
    """Send each rebuilt ThemeSet to the talk's phones as the `themes` SSE event."""
    await pipeline.publish_event(theme_set.talk_id, "themes", theme_set.model_dump(mode="json"))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await search.setup_indices()  # creates the Elasticsearch indices on first start
    on_themes(push_themes)
    yield
    await search.es.close()


app = FastAPI(title="RoomPass api", lifespan=lifespan)
app.include_router(pipeline.router)  # talks, audio, segments, SSE events, translate
app.include_router(themes_router)  # question themes


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
