import os

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
version = os.environ.get("APP_VERSION", "dev")


class Health(BaseModel):
    status: str
    version: str


@app.get("/healthz")
@app.get("/readyz")
def probe() -> str:
    return "ok"


@app.get("/api/health")
def health() -> Health:
    return Health(status="ok", version=version)
