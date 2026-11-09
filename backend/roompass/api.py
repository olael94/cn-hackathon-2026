import os

from fastapi import FastAPI

from roompass.generated.health import Health

app = FastAPI(title="RoomPass api")
version = os.environ.get("APP_VERSION", "dev")


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
