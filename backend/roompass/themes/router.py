from typing import Annotated

from elasticsearch import ApiError, TransportError
from fastapi import APIRouter, HTTPException, Path

from roompass.contract import ThemeSet
from roompass.themes.search import SearchFailed
from roompass.themes.service import latest_theme_set

router = APIRouter()


@router.get("/api/talks/{talk_id}/themes")
async def get_themes(talk_id: Annotated[str, Path(pattern="^[a-z0-9]{6}$")]) -> ThemeSet:
    try:
        return await latest_theme_set(talk_id)
    except (ApiError, TransportError, SearchFailed) as error:
        raise HTTPException(503, "Question themes are unavailable right now.") from error
