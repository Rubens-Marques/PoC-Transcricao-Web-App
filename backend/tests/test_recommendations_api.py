"""End-to-end HTTP contract for POST /api/recommendations."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database.db import connect
from database.seed import seed
from main import app


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    connection = connect()
    try:
        seed(connection)
    finally:
        connection.close()

    with TestClient(app) as test_client:
        yield test_client


def test_health_reports_the_active_provider(client: TestClient) -> None:
    # Act
    response = client.get("/health")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "provider": "mock"}


def test_returns_preferences_and_recommendations(client: TestClient) -> None:
    # Arrange
    payload = {"text": "I want a beach trip in December"}

    # Act
    response = client.post("/api/recommendations", json=payload)

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["preferences"]["category"] == "beach"
    assert body["preferences"]["month"] == "December"
    assert body["recommendations"]
    assert body["recommendations"][0]["category"] == "beach"


def test_recommendation_carries_the_fields_the_ui_renders(client: TestClient) -> None:
    # Act
    response = client.post("/api/recommendations", json={"text": "praia em janeiro"})

    # Assert
    first = response.json()["recommendations"][0]
    for field in ("name", "destination", "country", "price", "days", "match_reasons"):
        assert field in first


def test_empty_text_is_rejected(client: TestClient) -> None:
    # Act
    response = client.post("/api/recommendations", json={"text": ""})

    # Assert
    assert response.status_code == 422


def test_missing_text_is_rejected(client: TestClient) -> None:
    # Act
    response = client.post("/api/recommendations", json={})

    # Assert
    assert response.status_code == 422
