"""Reverse geocode. The browser never talks to Nominatim — only this service does."""

from __future__ import annotations

from typing import Any

import httpx

PLACE_MAX = 80
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "TravelyPoC/1.0 (https://poc.nexusdatabi.com)"


def _clip(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:PLACE_MAX]


def place_from_nominatim(payload: dict[str, Any]) -> dict[str, str] | None:
    address = payload.get("address")
    if not isinstance(address, dict):
        return None
    city = (
        _clip(address.get("city"))
        or _clip(address.get("town"))
        or _clip(address.get("village"))
        or _clip(address.get("municipality"))
    )
    if not city:
        return None
    state = _clip(address.get("state")) or _clip(address.get("region"))
    country = _clip(address.get("country")) or "Brasil"
    return {"city": city, "state": state, "country": country}


async def lookup_nominatim(lat: float, lon: float) -> dict[str, Any]:
    # City-level precision (~100 m). Do not forward full GPS to OSM.
    rounded_lat = round(lat, 3)
    rounded_lon = round(lon, 3)
    async with httpx.AsyncClient(
        timeout=8.0,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    ) as client:
        response = await client.get(
            NOMINATIM_URL,
            params={
                "format": "jsonv2",
                "lat": rounded_lat,
                "lon": rounded_lon,
                "accept-language": "pt-BR",
            },
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("nominatim payload")
        return data
