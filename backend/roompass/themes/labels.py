import os
from functools import cache

from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, ValidationError

from roompass.themes.grouping import ScoredQuestion, label_cites_only
from roompass.themes.prompts import THEME_LABEL_INSTRUCTIONS, theme_label_input

LABEL_MODEL = "gpt-5.4-mini"
MAX_LABEL_LENGTH = 80


class ThemeLabel(BaseModel):
    label: str
    question_ids: list[str]


@cache
def openai_client() -> AsyncOpenAI | None:
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    return AsyncOpenAI(timeout=15.0, max_retries=0)


def accept_label(parsed: ThemeLabel | None, theme_question_ids: list[str]) -> str | None:
    if parsed is None:
        return None
    label = parsed.label.strip()
    if not label or len(label) > MAX_LABEL_LENGTH:
        return None
    if not label_cites_only(parsed.question_ids, theme_question_ids):
        return None
    return label


async def write_label(group: list[ScoredQuestion]) -> str | None:
    client = openai_client()
    if client is None:
        return None
    question_ids = [q.id for q in group]
    prompt = theme_label_input([(q.id, q.text_en) for q in group])
    for _ in range(2):
        try:
            response = await client.responses.parse(
                model=LABEL_MODEL,
                instructions=THEME_LABEL_INSTRUCTIONS,
                input=prompt,
                text_format=ThemeLabel,
            )
        except (OpenAIError, ValidationError):
            continue
        label = accept_label(response.output_parsed, question_ids)
        if label is not None:
            return label
    return None
