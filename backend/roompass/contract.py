from datetime import datetime

from pydantic import BaseModel


class Theme(BaseModel):
    id: str
    label: str
    question_ids: list[str]
    top_question_id: str
    votes: int


class ThemeSet(BaseModel):
    talk_id: str
    themes: list[Theme]
    question_count: int
    off_topic_count: int
    built_at: datetime
