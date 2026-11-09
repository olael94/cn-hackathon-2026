# Elasticsearch is RoomPass's data layer: talks, caption segments and questions.  # NEW
import asyncio  # NEW
import os  # NEW
from typing import Any  # NEW

from elasticsearch import AsyncElasticsearch  # NEW: async client, so captions never block FastAPI
from opentelemetry import trace  # NEW

from roompass.contract import Match, Segment, Talk  # NEW: shared shapes, generated from schema/

tracer = trace.get_tracer("roompass.search")  # NEW

# NEW: "possibly covered" cutoffs (CONTRACT.md Match). Plain code decides, never a model.
COVERED_WITH_KEYWORD = 0.6  # semantic score needed when the words also match
# Tuned on Nov 9 with jina-embeddings-v3: related 0.69 to 0.81, unrelated 0.50 to 0.58.
COVERED_SEMANTIC_ONLY = 0.68  # semantic score needed on meaning alone
RRF_K = 60  # standard reciprocal rank fusion constant

# NEW: one client per process
es = AsyncElasticsearch(os.environ["ES_URL"], api_key=os.environ["ES_API_KEY"])
# NEW: multilingual embedding model, so a Spanish question can match an English caption
INFERENCE_ID = os.environ.get("ES_INFERENCE_ID", ".jina-embeddings-v3")

# NEW: field types per index, straight from CONTRACT.md "Elasticsearch indices"
MAPPINGS = {
    "talks": {
        "talk_id": {"type": "keyword"},  # exact match, used as the doc id too
        "title": {"type": "text"},
        "speaker_name": {"type": "text"},
        "room": {"type": "keyword"},
        "status": {"type": "keyword"},  # waiting | live | ended
        "started_at": {"type": "date"},
        "ended_at": {"type": "date"},
        "speaker_token_hash": {"type": "keyword"},  # never store the raw token
    },
    "segments": {
        "talk_id": {"type": "keyword"},
        "seq": {"type": "integer"},  # order of the 5 s chunk
        "t_start": {"type": "float"},  # seconds from talk start
        "t_end": {"type": "float"},
        "text_en": {"type": "text", "analyzer": "english"},  # BM25 with English stemming
        "text_es": {"type": "text", "analyzer": "spanish"},  # BM25 with Spanish stemming
        "semantic": {"type": "semantic_text", "inference_id": INFERENCE_ID},  # vector search
        "emitted_at": {"type": "date"},
    },
    "questions": {
        "id": {"type": "keyword"},
        "talk_id": {"type": "keyword"},
        "text": {"type": "text"},
        "lang": {"type": "keyword"},
        "text_en": {"type": "text", "analyzer": "english"},
        "votes": {"type": "integer"},
        "voters": {"type": "keyword"},  # device ids, for one vote per device
        "created_at": {"type": "date"},
        "semantic": {"type": "semantic_text", "inference_id": INFERENCE_ID},
        "topic_score": {"type": "float"},
    },
}


async def setup_indices() -> None:  # NEW: safe to call on every startup
    for name, properties in MAPPINGS.items():  # each index we need
        if not await es.indices.exists(index=name):  # skip ones that already exist
            await es.indices.create(index=name, mappings={"properties": properties})


async def index_segment(segment: Segment) -> None:  # NEW: store one caption line
    doc = segment.model_dump(mode="json")  # pydantic to plain JSON (dates as strings)
    doc["semantic"] = segment.text_en  # Elasticsearch embeds this text for semantic search
    await es.index(index="segments", id=segment.id, document=doc)  # id = {talk_id}-{seq}


# NEW: replay + first load
async def get_segments(talk_id: str, after_seq: int = -1) -> list[Segment]:
    response = await es.search(
        index="segments",
        query={
            "bool": {
                "filter": [  # filters: exact, no scoring needed
                    {"term": {"talk_id": talk_id}},  # this talk only
                    {"range": {"seq": {"gt": after_seq}}},  # only lines the phone hasn't seen
                ]
            }
        },
        sort=[{"seq": "asc"}],  # oldest first
        size=1000,  # a 1-hour talk is about 720 chunks
        source_excludes=["semantic"],  # the contract Segment has no "semantic" field
    )
    return [Segment.model_validate(hit["_source"]) for hit in response["hits"]["hits"]]


# NEW: store a talk. The speaker token is kept only as a hash.
async def save_talk(talk: Talk, speaker_token_hash: str) -> None:
    doc = talk.model_dump(mode="json") | {"speaker_token_hash": speaker_token_hash}
    await es.index(index="talks", id=talk.talk_id, document=doc)


# NEW: read a talk and its token hash, or None if it doesn't exist
async def get_talk(talk_id: str) -> tuple[Talk, str] | None:
    response = await es.options(ignore_status=404).get(index="talks", id=talk_id)
    if not response.get("found"):
        return None
    source = dict(response["_source"])
    token_hash = source.pop("speaker_token_hash")
    return Talk.model_validate(source), token_hash


# NEW: one search leg (keyword or semantic), limited to one talk when we know it
async def _search_segments(query: dict[str, Any], talk_id: str | None) -> list[dict[str, Any]]:
    filters = [{"term": {"talk_id": talk_id}}] if talk_id else []
    response = await es.search(
        index="segments",
        query={"bool": {"must": [query], "filter": filters}},
        size=5,  # top 5 per leg is plenty to fuse
        source_excludes=["semantic"],
    )
    return response["hits"]["hits"]


# NEW: "Possibly covered?" Hybrid search over the talk's real captions.
# Keyword (BM25, both languages) and semantic (multilingual embeddings) run in parallel,
# reciprocal rank fusion orders the results, and the semantic score alone decides `covered`.
async def check_question(text: str, talk_id: str | None = None) -> tuple[bool, list[Match]]:
    with tracer.start_as_current_span("questions.check") as span:
        span.set_attribute("talk.id", talk_id or "any")
        keyword_hits, semantic_hits = await asyncio.gather(
            _search_segments(
                {"multi_match": {"query": text, "fields": ["text_en", "text_es"]}}, talk_id
            ),
            _search_segments({"semantic": {"field": "semantic", "query": text}}, talk_id),
        )
        keyword_ids = {hit["_id"] for hit in keyword_hits}
        semantic_score = {hit["_id"]: hit["_score"] for hit in semantic_hits}  # (1 + cos) / 2
        sources = {hit["_id"]: hit["_source"] for hit in keyword_hits + semantic_hits}

        # RRF: each leg adds 1 / (k + rank); lines found by both legs rise to the top.
        fused: dict[str, float] = {}
        for hits in (keyword_hits, semantic_hits):
            for rank, hit in enumerate(hits, start=1):
                fused[hit["_id"]] = fused.get(hit["_id"], 0.0) + 1 / (RRF_K + rank)
        # Ties (one leg ranks A first, the other B) go to the higher semantic score.
        ordered = sorted(fused, key=lambda i: (fused[i], semantic_score.get(i, 0.0)), reverse=True)[
            :3
        ]

        matches = [
            Match(
                segment_id=segment_id,
                seq=sources[segment_id]["seq"],
                t_start=sources[segment_id]["t_start"],
                text_en=sources[segment_id]["text_en"],
                text_es=sources[segment_id].get("text_es"),
                score=min(1.0, semantic_score.get(segment_id, 0.0)),
                keyword_hit=segment_id in keyword_ids,
            )
            for segment_id in ordered
        ]
        top = matches[0] if matches else None
        covered = bool(
            top
            and (
                (top.keyword_hit and top.score >= COVERED_WITH_KEYWORD)
                or top.score >= COVERED_SEMANTIC_ONLY
            )
        )
        span.set_attributes(
            {"match.top_score": top.score if top else 0.0, "match.covered": covered}
        )
        return covered, matches
