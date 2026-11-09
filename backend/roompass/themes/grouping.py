from dataclasses import dataclass

ON_TOPIC_MIN_SCORE = 0.65
SAME_THEME_MIN_SCORE = 0.75
MAX_THEMES = 5


@dataclass(frozen=True)
class ScoredQuestion:
    id: str
    text_en: str
    votes: int
    topic_score: float


def on_topic(questions: list[ScoredQuestion]) -> list[ScoredQuestion]:
    return [q for q in questions if q.topic_score >= ON_TOPIC_MIN_SCORE]


def group_questions(
    questions: list[ScoredQuestion], neighbor_scores: dict[str, dict[str, float]]
) -> list[list[ScoredQuestion]]:
    ranked = sorted(on_topic(questions), key=lambda q: -q.votes)
    grouped: set[str] = set()
    groups: list[list[ScoredQuestion]] = []
    for seed in ranked:
        if seed.id in grouped:
            continue
        scores = neighbor_scores.get(seed.id, {})
        group = [seed] + [
            q
            for q in ranked
            if q.id != seed.id
            and q.id not in grouped
            and scores.get(q.id, 0.0) >= SAME_THEME_MIN_SCORE
        ]
        grouped.update(q.id for q in group)
        if len(group) > 1:
            groups.append(group)
    groups.sort(key=lambda group: -sum(q.votes for q in group))
    return groups[:MAX_THEMES]


def label_cites_only(cited_ids: list[str], theme_question_ids: list[str]) -> bool:
    return bool(cited_ids) and set(cited_ids) <= set(theme_question_ids)
