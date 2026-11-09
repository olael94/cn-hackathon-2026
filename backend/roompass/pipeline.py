"""Audio to captions: talks, audio chunks, transcription, translation, SSE fan-out.

Flow per chunk (CONTRACT.md "Audio chunks"):
  POST audio -> OpenAI transcription (EN) -> translation (EN to ES) -> publish in seq order
  -> SSE to every phone in the room, and index in Elasticsearch.

Live state (subscribers, recent segments, ordering) is in memory, which is why the backend
runs one replica with strategy Recreate.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import string
import time
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from openai import AsyncOpenAI
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel
from sse_starlette import EventSourceResponse

from roompass import prompts, search
from roompass.contract import Segment, Talk, TranslateRequest, TranslateResponse

log = logging.getLogger("roompass.pipeline")
tracer = trace.get_tracer("roompass.pipeline")
router = APIRouter(prefix="/api")

# Model names come from env so they can change without a code edit.
STT_MODEL = os.environ.get("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe")
TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-mini")
# Miguel's translator Deployment. Unset locally, so translation runs in this process.
TRANSLATOR_URL = os.environ.get("TRANSLATOR_URL", "").rstrip("/")

GAP_TIMEOUT_S = 10.0  # skip a missing chunk 10 s after the next one arrived
BUFFER_SIZE = 300  # recent segments kept in memory for reconnect replay (25 min of talk)
OPENAI_TIMEOUT_S = 15.0

openai_client = AsyncOpenAI(timeout=OPENAI_TIMEOUT_S, max_retries=1)


# ---------- request and response bodies that are not shared shapes ----------


class CreateTalkRequest(BaseModel):
    title: str
    speaker_name: str
    room: str


class CreateTalkResponse(BaseModel):
    talk: Talk
    speaker_token: str


class AudioAccepted(BaseModel):
    seq: int


# ---------- in-memory state per talk ----------


@dataclass
class TalkState:
    talk: Talk
    token_hash: str
    buffer: deque[Segment] = field(default_factory=lambda: deque(maxlen=BUFFER_SIZE))
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)
    next_publish: int = 0  # the seq we publish next
    done: dict[int, Segment | None] = field(default_factory=dict)  # finished, waiting for order
    arrived_at: dict[int, float] = field(default_factory=dict)  # seq -> monotonic arrival time
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


talks: dict[str, TalkState] = {}
background_tasks: set[asyncio.Task[None]] = set()


def spawn(coroutine: Any) -> None:
    """Run in the background and keep a reference so the task isn't garbage collected."""
    task = asyncio.create_task(coroutine)
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)


def now_utc() -> datetime:
    return datetime.now(UTC)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_talk_id() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


async def load_state(talk_id: str) -> TalkState:
    """The talk's live state, loaded from Elasticsearch after a restart."""
    state = talks.get(talk_id)
    if state:
        return state
    found = await search.get_talk(talk_id)
    if not found:
        raise HTTPException(status_code=404, detail="Talk not found")
    talk, token_hash = found
    state = TalkState(talk=talk, token_hash=token_hash)
    # Continue numbering after what is already stored, so ids are never reused.
    stored = await search.get_segments(talk_id)
    if stored:
        state.next_publish = stored[-1].seq + 1
        state.buffer.extend(stored[-BUFFER_SIZE:])
    # Another request may have loaded the talk while we awaited Elasticsearch.
    return talks.setdefault(talk_id, state)


def require_speaker(state: TalkState, token: str | None) -> None:
    if not token or not hmac.compare_digest(hash_token(token), state.token_hash):
        raise HTTPException(status_code=401, detail="Bad or missing speaker token")


async def set_status(state: TalkState, status: str) -> Talk:
    data = state.talk.model_dump(mode="json") | {"status": status}
    if status == "live" and state.talk.started_at is None:
        data["started_at"] = now_utc().isoformat()
    if status == "ended":
        data["ended_at"] = now_utc().isoformat()
    state.talk = Talk.model_validate(data)
    await search.save_talk(state.talk, state.token_hash)
    publish(state, "talk", state.talk.model_dump(mode="json"))
    return state.talk


# ---------- fan-out ----------


def publish(
    state: TalkState, event: str, data: dict[str, Any], event_id: str | None = None
) -> None:
    """Send one SSE event to every phone watching this talk. Kevin's Q&A uses this too."""
    message: dict[str, Any] = {"event": event, "data": json.dumps(data)}
    if event_id is not None:
        message["id"] = event_id
    for queue in list(state.subscribers):
        queue.put_nowait(message)


async def publish_event(talk_id: str, event: str, data: dict[str, Any]) -> None:
    """Public helper for other modules (questions, themes): publish by talk id."""
    publish(await load_state(talk_id), event, data)


# ---------- transcription and translation ----------


async def transcribe(audio: bytes, filename: str, talk_id: str, seq: int, duration: float) -> str:
    with tracer.start_as_current_span("pipeline.transcribe") as span:
        span.set_attributes(
            {
                "talk.id": talk_id,
                "segment.seq": seq,
                "gen_ai.request.model": STT_MODEL,
                "audio.duration_s": duration,
            }
        )
        result = await openai_client.audio.transcriptions.create(
            model=STT_MODEL, file=(filename, audio), language="en"
        )
        text = result.text.strip()
        span.set_attribute("transcript.chars", len(text))
        return text


async def translate_local(text: str, source: str, target: str) -> str:
    system = prompts.TRANSLATE_SYSTEM.format(
        source=prompts.LANGUAGE_NAMES[source], target=prompts.LANGUAGE_NAMES[target]
    )
    response = await openai_client.chat.completions.create(
        model=TEXT_MODEL,
        temperature=0,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": text}],
    )
    return (response.choices[0].message.content or "").strip()


async def translate(text: str, talk_id: str, seq: int) -> str | None:
    """EN to ES. Returns None on failure so the English caption still goes out."""
    with tracer.start_as_current_span("pipeline.translate") as span:
        span.set_attributes(
            {
                "talk.id": talk_id,
                "segment.seq": seq,
                "gen_ai.request.model": TEXT_MODEL,
                "translator.remote": bool(TRANSLATOR_URL),
                "translator.fallback": False,
            }
        )
        try:
            if TRANSLATOR_URL:
                try:
                    async with httpx.AsyncClient(timeout=OPENAI_TIMEOUT_S) as client:
                        response = await client.post(
                            f"{TRANSLATOR_URL}/api/translate",
                            json={"text": text, "source": "en", "target": "es"},
                            headers={"X-Internal-Token": os.environ.get("TRANSLATOR_TOKEN", "")},
                        )
                        response.raise_for_status()
                        return TranslateResponse.model_validate(response.json()).text
                except httpx.TimeoutException:
                    raise  # a slow translator should show as lag, not be hidden
                except Exception as error:  # noqa: BLE001 - rejected or unreachable translator
                    # Keep Spanish captions flowing: translate here instead.
                    span.set_attribute("translator.fallback", True)
                    log.warning("translator unavailable, local fallback: %s", type(error).__name__)
            return await translate_local(text, "en", "es")
        except Exception as error:  # noqa: BLE001 - any failure means "no Spanish"
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, type(error).__name__))
            log.warning("translate failed talk=%s seq=%s: %s", talk_id, seq, type(error).__name__)
            return None


# ---------- ordering ----------


async def flush(state: TalkState) -> None:
    """Publish finished chunks in seq order. Skip a chunk that failed, or one still missing
    GAP_TIMEOUT_S after a later chunk arrived."""
    async with state.lock:
        while True:
            seq = state.next_publish
            if seq in state.done:
                segment = state.done.pop(seq)
                arrived = state.arrived_at.pop(seq, time.monotonic())
                state.next_publish += 1
                if segment is not None:
                    await emit(state, segment, time.monotonic() - arrived)
                continue
            later = [t for s, t in state.arrived_at.items() if s > seq]
            if later and time.monotonic() - min(later) >= GAP_TIMEOUT_S:
                log.warning("skipping seq talk=%s seq=%s", state.talk.talk_id, seq)
                state.arrived_at.pop(seq, None)
                state.next_publish += 1
                continue
            return


async def emit(state: TalkState, segment: Segment, lag: float) -> None:
    with tracer.start_as_current_span("pipeline.publish") as span:
        span.set_attributes(
            {
                "talk.id": segment.talk_id,
                "segment.seq": segment.seq,
                "sse.subscribers": len(state.subscribers),
                "roompass.caption.lag": lag,
                "roompass.caption.late": str(lag > 10).lower(),
            }
        )
        state.buffer.append(segment)
        publish(state, "segment", segment.model_dump(mode="json"), event_id=str(segment.seq))
    spawn(index_quietly(segment))  # phones first, Elasticsearch right after


async def index_quietly(segment: Segment) -> None:
    with tracer.start_as_current_span("pipeline.index") as span:
        span.set_attributes({"talk.id": segment.talk_id, "segment.seq": segment.seq})
        try:
            await search.index_segment(segment)
        except Exception as error:  # noqa: BLE001 - captions already went out
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, type(error).__name__))
            log.error("index failed talk=%s seq=%s", segment.talk_id, segment.seq)


async def process_chunk(
    state: TalkState, audio: bytes, filename: str, seq: int, t_start: float, t_end: float
) -> None:
    talk_id = state.talk.talk_id
    segment: Segment | None = None
    try:
        text_en = await transcribe(audio, filename, talk_id, seq, t_end - t_start)
        if text_en:  # silence gives no caption
            text_es = await translate(text_en, talk_id, seq)
            segment = Segment(
                id=f"{talk_id}-{seq}",
                talk_id=talk_id,
                seq=seq,
                t_start=t_start,
                t_end=t_end,
                text_en=text_en,
                text_es=text_es,
                emitted_at=now_utc(),
            )
    except Exception as error:  # noqa: BLE001 - a failed chunk is skipped, not fatal
        log.warning("chunk failed talk=%s seq=%s: %s", talk_id, seq, type(error).__name__)
    if seq >= state.next_publish:  # a chunk that arrives after we skipped it is discarded
        state.done[seq] = segment
    await flush(state)


async def gap_check(state: TalkState) -> None:
    await asyncio.sleep(GAP_TIMEOUT_S + 0.5)
    await flush(state)


# ---------- routes ----------


@router.post("/talks")
async def create_talk(body: CreateTalkRequest) -> CreateTalkResponse:
    return await provision_talk(body, secrets.token_urlsafe(24))


async def provision_talk(body: CreateTalkRequest, token: str) -> CreateTalkResponse:
    talk = Talk(
        talk_id=new_talk_id(),
        title=body.title,
        speaker_name=body.speaker_name,
        room=body.room,
        status="waiting",
        started_at=None,
        ended_at=None,
    )
    state = TalkState(talk=talk, token_hash=hash_token(token))
    await search.save_talk(talk, state.token_hash)
    talks[talk.talk_id] = state
    return CreateTalkResponse(talk=talk, speaker_token=token)


@router.get("/talks/{talk_id}")
async def get_talk(talk_id: str) -> Talk:
    return (await load_state(talk_id)).talk


@router.get("/talks/{talk_id}/capture")
async def capture_position(
    talk_id: str, x_speaker_token: Annotated[str | None, Header()] = None
) -> dict[str, float | int]:
    state = await load_state(talk_id)
    require_speaker(state, x_speaker_token)
    if state.talk.status != "live" or not state.talk.started_at:
        raise HTTPException(409, "Voice capture has ended.")
    return {
        "seq": max([state.next_publish - 1, *state.arrived_at, *state.done]) + 1,
        "elapsed": (now_utc() - state.talk.started_at).total_seconds(),
    }


@router.post("/talks/{talk_id}/start")
async def start_talk(talk_id: str, x_speaker_token: Annotated[str | None, Header()] = None) -> Talk:
    state = await load_state(talk_id)
    require_speaker(state, x_speaker_token)
    return await set_status(state, "live")


@router.post("/talks/{talk_id}/stop")
async def stop_talk(talk_id: str, x_speaker_token: Annotated[str | None, Header()] = None) -> Talk:
    state = await load_state(talk_id)
    require_speaker(state, x_speaker_token)
    # Drain: wait up to 5 s for chunks still being transcribed, then skip whatever is missing.
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and any(s not in state.done for s in state.arrived_at):
        await asyncio.sleep(0.25)
    known = set(state.arrived_at) | set(state.done)
    for seq in range(state.next_publish, max(known, default=-1) + 1):
        state.done.setdefault(seq, None)
    await flush(state)
    return await set_status(state, "ended")


@router.post("/talks/{talk_id}/audio", status_code=202)
async def upload_audio(
    talk_id: str,
    file: Annotated[UploadFile, File()],
    seq: Annotated[int, Form()],
    t_start: Annotated[float, Form()],
    t_end: Annotated[float, Form()],
    x_speaker_token: Annotated[str | None, Header()] = None,
) -> AudioAccepted:
    state = await load_state(talk_id)
    require_speaker(state, x_speaker_token)
    if state.talk.status != "live":
        raise HTTPException(status_code=409, detail="Talk is not live")
    if not (0 <= seq <= state.next_publish + 300 and 0 <= t_start < t_end):
        raise HTTPException(422, "Invalid voice chunk position.")
    audio = await file.read(2_000_001)
    if not audio or len(audio) > 2_000_000:
        raise HTTPException(413, "Invalid voice chunk size.")
    if seq < state.next_publish or seq in state.arrived_at:
        return AudioAccepted(seq=seq)
    state.arrived_at.setdefault(seq, time.monotonic())
    # Answer the speaker page right away; the work runs in the background.
    spawn(process_chunk(state, audio, file.filename or "chunk.webm", seq, t_start, t_end))
    spawn(gap_check(state))
    return AudioAccepted(seq=seq)


@router.get("/talks/{talk_id}/segments")
async def list_segments(talk_id: str, after_seq: int = -1) -> list[Segment]:
    await load_state(talk_id)
    return await search.get_segments(talk_id, after_seq)


@router.get("/talks/{talk_id}/events")
async def events(
    talk_id: str, request: Request, last_event_id: Annotated[str | None, Header()] = None
) -> EventSourceResponse:
    state = await load_state(talk_id)
    after = int(last_event_id) if last_event_id and last_event_id.isdigit() else -1
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    state.subscribers.add(queue)  # subscribe first, so nothing published during replay is lost

    async def stream() -> AsyncIterator[dict[str, Any]]:
        try:
            hello = {
                "server_time": now_utc().isoformat(),
                "talk": state.talk.model_dump(mode="json"),
                "questions": [],  # Kevin's Q&A fills this
            }
            yield {"event": "hello", "data": json.dumps(hello)}
            # Replay: buffer first, Elasticsearch for anything older, deduped by seq.
            replay = {s.seq: s for s in state.buffer if s.seq > after}
            oldest_in_buffer = state.buffer[0].seq if state.buffer else None
            if oldest_in_buffer is None or oldest_in_buffer > after + 1:
                for s in await search.get_segments(talk_id, after):
                    replay.setdefault(s.seq, s)
            sent = after
            for seq in sorted(replay):
                sent = seq
                yield {
                    "event": "segment",
                    "id": str(seq),
                    "data": json.dumps(replay[seq].model_dump(mode="json")),
                }
            while True:
                message = await queue.get()
                if message["event"] == "segment" and int(message["id"]) <= sent:
                    continue  # already replayed
                yield message
        finally:
            state.subscribers.discard(queue)

    return EventSourceResponse(stream(), ping=15, headers={"X-Accel-Buffering": "no"})


@router.post("/translate")
async def translate_route(
    body: TranslateRequest, x_internal_token: Annotated[str | None, Header()] = None
) -> TranslateResponse:
    """Used by the translator Deployment (TRANSLATOR_URL). Same code, own pod and scaling."""
    expected = os.environ.get("TRANSLATOR_TOKEN", "")
    if not expected or not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=401, detail="Internal only")
    if body.source not in prompts.LANGUAGE_NAMES or body.target not in prompts.LANGUAGE_NAMES:
        raise HTTPException(status_code=422, detail="Only en and es are supported")
    return TranslateResponse(text=await translate_local(body.text, body.source, body.target))
