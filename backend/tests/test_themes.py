from roompass.themes.grouping import ScoredQuestion, group_questions
from roompass.themes.labels import ThemeLabel, accept_label


def question(question_id: str, votes: int, topic_score: float = 0.9) -> ScoredQuestion:
    return ScoredQuestion(question_id, f"text of {question_id}", votes, topic_score)


def test_groups_on_topic_questions_by_votes() -> None:
    questions = [
        question("q_a", 5),
        question("q_b", 1),
        question("q_c", 4),
        question("q_d", 3),
        question("q_e", 9, topic_score=0.3),
        question("q_f", 2),
    ]
    neighbors = {
        "q_a": {"q_b": 0.8, "q_c": 0.6, "q_e": 0.95},
        "q_c": {"q_d": 0.76, "q_b": 0.9},
        "q_f": {"q_a": 0.99},
    }

    groups = group_questions(questions, neighbors)

    assert [[q.id for q in group] for group in groups] == [["q_c", "q_d"], ["q_a", "q_b"]]


def test_label_must_cite_only_its_own_questions() -> None:
    theme_ids = ["q_a", "q_b"]
    assert accept_label(ThemeLabel(label="Autoscaling requests", question_ids=["q_a"]), theme_ids)
    assert accept_label(ThemeLabel(label="Mixed", question_ids=["q_a", "q_z"]), theme_ids) is None
    assert accept_label(ThemeLabel(label="Nothing cited", question_ids=[]), theme_ids) is None
    assert accept_label(None, theme_ids) is None
