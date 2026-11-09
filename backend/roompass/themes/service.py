import asyncio
import logging
from collections import defaultdict
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from opentelemetry import trace

from roompass.contract import Theme, ThemeSet
from roompass.themes.grouping import ScoredQuestion, group_questions, on_topic
from roompass.themes.labels import LABEL_MODEL, write_label
from roompass.themes.search import (
    es_client,
    fetch_questions,
    neighbor_scores,
    store_topic_scores,
    topic_scores,
)

REBUILD_AFTER_NEW_QUESTIONS = 5
REBUILD_AFTER_SECONDS = 60.0

ThemeListener = Callable[[ThemeSet], Awaitable[None]]

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("roompass.themes")

_listeners: list[ThemeListener] = []
_latest: dict[str, ThemeSet] = {}
_new_questions: dict[str, int] = defaultdict(int)
_timers: dict[str, asyncio.Task[None]] = {}
_running: set[asyncio.Task[None]] = set()
_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
_label_cache: dict[tuple[str, ...], str] = {}


def on_themes(listener: ThemeListener) -> None:
    _listeners.append(listener)


async def note_question_change(talk_id: str, new_question: bool) -> None:
    if new_question:
        _new_questions[talk_id] += 1
    if _new_questions[talk_id] >= REBUILD_AFTER_NEW_QUESTIONS:
        timer = _timers.pop(talk_id, None)
        if timer is not None:
            timer.cancel()
        _schedule(talk_id, 0.0)
    elif talk_id not in _timers:
        _schedule(talk_id, REBUILD_AFTER_SECONDS)


def _schedule(talk_id: str, delay: float) -> None:
    task = asyncio.create_task(_rebuild_after(talk_id, delay))
    _timers[talk_id] = task
    _running.add(task)
    task.add_done_callback(_running.discard)


async def _rebuild_after(talk_id: str, delay: float) -> None:
    await asyncio.sleep(delay)
    _timers.pop(talk_id, None)
    _new_questions.pop(talk_id, None)
    try:
        theme_set = await rebuild(talk_id)
    except Exception as error:
        logger.warning("themes rebuild failed for talk %s: %s", talk_id, type(error).__name__)
        return
    for listener in _listeners:
        try:
            await listener(theme_set)
        except Exception as error:
            logger.warning("themes listener failed for talk %s: %s", talk_id, type(error).__name__)


async def rebuild(talk_id: str) -> ThemeSet:
    async with _locks[talk_id]:
        theme_set = await build_theme_set(talk_id)
        _latest[talk_id] = theme_set
        return theme_set


async def latest_theme_set(talk_id: str) -> ThemeSet:
    cached = _latest.get(talk_id)
    if (
        cached is not None
        and (datetime.now(UTC) - cached.built_at).total_seconds() < REBUILD_AFTER_SECONDS
    ):
        return cached
    return await rebuild(talk_id)


def _empty(talk_id: str) -> ThemeSet:
    return ThemeSet(
        talk_id=talk_id,
        themes=[],
        question_count=0,
        off_topic_count=0,
        built_at=datetime.now(UTC),
    )


async def _label(group: list[ScoredQuestion]) -> str | None:
    key = tuple(sorted(q.id for q in group))
    if key not in _label_cache:
        label = await write_label(group)
        if label is None:
            return None
        _label_cache[key] = label
    return _label_cache[key]


async def build_theme_set(talk_id: str) -> ThemeSet:
    with tracer.start_as_current_span("themes.build") as span:
        span.set_attribute("talk.id", talk_id)
        span.set_attribute("gen_ai.request.model", LABEL_MODEL)
        es = es_client()
        if es is None:
            theme_set = _empty(talk_id)
            labels_dropped = 0
        else:
            stored = await asyncio.to_thread(fetch_questions, es, talk_id)
            pairs = [(q["id"], q["text_en"]) for q in stored]
            scores = await asyncio.to_thread(topic_scores, es, talk_id, pairs)
            changed = {
                q["id"]: scores[q["id"]]
                for q in stored
                if q.get("topic_score") is None or abs(q["topic_score"] - scores[q["id"]]) > 1e-3
            }
            failed = await asyncio.to_thread(store_topic_scores, es, changed)
            if failed:
                logger.warning("themes: %d topic_score updates failed", failed)
            questions = [
                ScoredQuestion(q["id"], q["text_en"], q.get("votes", 0), scores[q["id"]])
                for q in stored
            ]
            relevant = on_topic(questions)
            neighbors = await asyncio.to_thread(
                neighbor_scores, es, talk_id, [(q.id, q.text_en) for q in relevant]
            )
            groups = group_questions(questions, neighbors)
            labels = await asyncio.gather(*(_label(group) for group in groups))
            labels_dropped = sum(1 for label in labels if label is None)
            themes = [
                Theme(
                    id=f"th_{group[0].id.removeprefix('q_')}",
                    label=label or group[0].text_en,
                    question_ids=[q.id for q in group],
                    top_question_id=group[0].id,
                    votes=sum(q.votes for q in group),
                )
                for group, label in zip(groups, labels, strict=True)
            ]
            theme_set = ThemeSet(
                talk_id=talk_id,
                themes=themes,
                question_count=len(questions),
                off_topic_count=len(questions) - len(relevant),
                built_at=datetime.now(UTC),
            )
        span.set_attribute("themes.count", len(theme_set.themes))
        span.set_attribute("questions.count", theme_set.question_count)
        span.set_attribute("questions.off_topic", theme_set.off_topic_count)
        span.set_attribute("themes.labels_dropped", labels_dropped)
        return theme_set
