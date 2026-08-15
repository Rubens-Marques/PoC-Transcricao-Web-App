"""POST /api/place — reverse geocode without sending coords from the browser to OSM."""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from database.db import connect
from database.seed import seed
from main import app
from services.place import place_from_nominatim


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    connection = connect()
    try:
        seed(connection)
    finally:
        connection.close()

    with TestClient(app) as test_client:
        yield test_client


def test_maps_town_when_city_is_missing() -> None:
    place = place_from_nominatim(
        {
            "address": {
                "town": "Campinas",
                "state": "São Paulo",
                "country": "Brazil",
            }
        }
    )

    assert place == {
        "city": "Campinas",
        "state": "São Paulo",
        "country": "Brazil",
    }


def test_rejects_payload_without_a_locality() -> None:
    assert place_from_nominatim({"address": {"country": "Brazil"}}) is None


def test_rejects_out_of_range_latitude(client: TestClient) -> None:
    response = client.post("/api/place", json={"lat": 91, "lon": -47.0})

    assert response.status_code == 422


def test_returns_place_from_nominatim(client: TestClient) -> None:
    mocked = AsyncMock(
        return_value={
            "address": {
                "city": "Campinas",
                "state": "São Paulo",
                "country": "Brazil",
            }
        }
    )

    with patch("routes.place.lookup_nominatim", mocked):
        response = client.post(
            "/api/place",
            json={"lat": -22.9, "lon": -47.06},
        )

    assert response.status_code == 200
    assert response.json() == {
        "city": "Campinas",
        "state": "São Paulo",
        "country": "Brazil",
    }
    mocked.assert_awaited_once()


def test_nominatim_failure_is_a_gateway_error(client: TestClient) -> None:
    with patch(
        "routes.place.lookup_nominatim",
        AsyncMock(side_effect=TimeoutError()),
    ):
        response = client.post("/api/place", json={"lat": -22.9, "lon": -47.06})

    assert response.status_code == 502
    assert "detail" in response.json()
