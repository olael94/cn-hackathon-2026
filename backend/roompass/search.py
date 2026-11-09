# Elasticsearch is RoomPass's data layer: talks, caption segments and questions.  # NEW
import os  # NEW

from elasticsearch import AsyncElasticsearch  # NEW: async client, so captions never block FastAPI

from roompass.contract import Segment, Talk  # NEW: shared shapes, generated from schema/

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
