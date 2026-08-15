"""POST /api/place — city/state/country from coordinates."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.place import lookup_nominatim, place_from_nominatim

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["place"])


class PlaceRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class PlaceResponse(BaseModel):
    city: str
    state: str
    country: str


@router.post("/place", response_model=PlaceResponse)
async def create_place(payload: PlaceRequest) -> PlaceResponse:
    try:
        raw = await lookup_nominatim(payload.lat, payload.lon)
    except Exception as exc:
        logger.warning("place lookup failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="I could not find the city right now.",
        ) from exc

    place = place_from_nominatim(raw)
    if place is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="I could not find the city right now.",
        )
    return PlaceResponse(**place)
