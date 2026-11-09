import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from roompass import pipeline, search
from roompass.contract import Health

logging.basicConfig(level=logging.INFO)
version = os.environ.get("APP_VERSION", "dev")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await search.setup_indices()  # creates the Elasticsearch indices on first start
    yield
    await search.es.close()


app = FastAPI(title="RoomPass api", lifespan=lifespan)
app.include_router(pipeline.router)  # talks, audio, segments, SSE events, translate


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
