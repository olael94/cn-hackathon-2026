import os
from functools import cache
from typing import Any

from elasticsearch import Elasticsearch, NotFoundError

QUESTIONS_INDEX = "questions"
SEGMENTS_INDEX = "segments"
MAX_QUESTIONS = 200


class SearchFailed(Exception):
    pass


@cache
def es_client() -> Elasticsearch | None:
    url = os.environ.get("ES_URL")
    api_key = os.environ.get("ES_API_KEY")
    if not url or not api_key:
        return None
    return Elasticsearch(url, api_key=api_key, request_timeout=10)


def fetch_questions(es: Elasticsearch, talk_id: str) -> list[dict[str, Any]]:
    try:
        response = es.search(
            index=QUESTIONS_INDEX,
            query={"term": {"talk_id": talk_id}},
            sort=[{"votes": "desc"}],
            size=MAX_QUESTIONS,
            source=["text_en", "votes", "topic_score"],
        )
    except NotFoundError:
        return []
    return [{"id": hit["_id"], **hit["_source"]} for hit in response["hits"]["hits"]]


def _semantic_search(talk_id: str, text: str, size: int) -> dict[str, Any]:
    return {
        "size": size,
        "_source": False,
        "query": {
            "bool": {
                "must": {"semantic": {"field": "semantic", "query": text}},
                "filter": {"term": {"talk_id": talk_id}},
            }
        },
    }


def _msearch(
    es: Elasticsearch, index: str, bodies: list[dict[str, Any]]
) -> list[list[dict[str, Any]]]:
    if not bodies:
        return []
    searches: list[dict[str, Any]] = []
    for body in bodies:
        searches += [{"index": index}, body]
    results: list[list[dict[str, Any]]] = []
    for response in es.msearch(searches=searches)["responses"]:
        if "error" in response:
            raise SearchFailed(f"{index} search failed: {response['error'].get('type')}")
        results.append(response["hits"]["hits"])
    return results


def topic_scores(
    es: Elasticsearch, talk_id: str, questions: list[tuple[str, str]]
) -> dict[str, float]:
    hits = _msearch(es, SEGMENTS_INDEX, [_semantic_search(talk_id, t, 1) for _, t in questions])
    return {
        question_id: (top[0]["_score"] if top else 0.0)
        for (question_id, _), top in zip(questions, hits, strict=True)
    }


def neighbor_scores(
    es: Elasticsearch, talk_id: str, questions: list[tuple[str, str]]
) -> dict[str, dict[str, float]]:
    size = len(questions)
    hits = _msearch(es, QUESTIONS_INDEX, [_semantic_search(talk_id, t, size) for _, t in questions])
    return {
        question_id: {hit["_id"]: hit["_score"] for hit in neighbors}
        for (question_id, _), neighbors in zip(questions, hits, strict=True)
    }


def store_topic_scores(es: Elasticsearch, scores: dict[str, float]) -> int:
    if not scores:
        return 0
    operations: list[dict[str, Any]] = []
    for question_id, score in scores.items():
        operations += [
            {"update": {"_index": QUESTIONS_INDEX, "_id": question_id}},
            {"doc": {"topic_score": score}},
        ]
    response = es.bulk(operations=operations)
    return sum(1 for item in response["items"] if "error" in item["update"])
