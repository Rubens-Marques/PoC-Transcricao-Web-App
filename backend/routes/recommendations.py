"""POST /api/recommendations — the whole pipeline in one endpoint."""

from __future__ import annotations

import logging
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from database.db import get_connection
from models.travel import RecommendationRequest, RecommendationResponse
from services.llm_service import (
    LLMConfigurationError,
    LLMExtractionError,
    extract_travel_preferences,
)
from services.search_service import search_packages

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.post(
    "/recommendations",
    response_model=RecommendationResponse,
    summary="Turn a spoken travel request into ranked package suggestions",
)
async def create_recommendations(
    payload: RecommendationRequest,
    connection: sqlite3.Connection = Depends(get_connection),
) -> RecommendationResponse:
    try:
        preferences = await extract_travel_preferences(payload.text)
    except LLMConfigurationError as exc:
        # A misconfigured server, not a bad request — surface it clearly.
        logger.error("LLM provider is misconfigured: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except LLMExtractionError as exc:
        logger.warning("LLM extraction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    recommendations = search_packages(connection, preferences)
    return RecommendationResponse(
        preferences=preferences, recommendations=recommendations
    )
