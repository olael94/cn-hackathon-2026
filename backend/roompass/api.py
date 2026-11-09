import os

from fastapi import FastAPI

from roompass.demo_questions import router as demo_questions
from roompass.generated.health import Health

app = FastAPI(title="RoomPass api")
app.include_router(demo_questions)
version = os.environ.get("APP_VERSION", "dev")


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
