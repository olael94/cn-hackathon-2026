"""Shared shapes from CONTRACT.md. Import them from here, never from generated/ directly.

The models are generated from schema/*.json by scripts/gen-types.sh. Change the schema, then
regenerate; don't edit or redefine them here.
"""

from roompass.generated.catchup import Bullet, CatchUp
from roompass.generated.health import Health
from roompass.generated.match import Match
from roompass.generated.question import Question
from roompass.generated.segment import Segment
from roompass.generated.talk import Talk
from roompass.generated.themeset import Theme, ThemeSet
from roompass.generated.translate_request import TranslateRequest
from roompass.generated.translate_response import TranslateResponse

__all__ = [
    "Bullet",
    "CatchUp",
    "Health",
    "Match",
    "Question",
    "Segment",
    "Talk",
    "Theme",
    "ThemeSet",
    "TranslateRequest",
    "TranslateResponse",
]
