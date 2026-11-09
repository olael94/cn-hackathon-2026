import os

from fastapi import FastAPI

from roompass.generated.health import Health
from roompass.themes import router as themes_router

app = FastAPI(title="RoomPass api")
app.include_router(themes_router)
version = os.environ.get("APP_VERSION", "dev")


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
