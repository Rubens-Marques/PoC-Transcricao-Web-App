"""Contrato HTTP de POST /api/signup/interpret."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def test_interprets_a_marital_status_answer(client: TestClient) -> None:
    # Act
    response = client.post(
        "/api/signup/interpret",
        json={"field": "maritalStatus", "text": "married for 20 years"},
    )

    # Assert
    assert response.status_code == 200
    assert response.json()["answer"]["marital_status"] == "married"


def test_answer_carries_every_field_the_ui_reads(client: TestClient) -> None:
    # Act
    response = client.post(
        "/api/signup/interpret", json={"field": "name", "text": "my name is Maria"}
    )

    # Assert
    answer = response.json()["answer"]
    for field in (
        "full_name",
        "email",
        "birth_date",
        "age",
        "city",
        "state",
        "country",
        "marital_status",
        "has_minor_children",
        "minor_children_count",
        "hobbies",
    ):
        assert field in answer


def test_unknown_field_is_rejected(client: TestClient) -> None:
    # Act
    response = client.post(
        "/api/signup/interpret", json={"field": "cpf", "text": "123"}
    )

    # Assert
    assert response.status_code == 422


def test_empty_text_is_rejected(client: TestClient) -> None:
    # Act
    response = client.post("/api/signup/interpret", json={"field": "name", "text": ""})

    # Assert
    assert response.status_code == 422


def test_overlong_text_is_rejected(client: TestClient) -> None:
    # O teto bate com LIMITS.chat no cliente: um texto maior é chamada
    # malformada, e não vale gastar inferência com ela.
    response = client.post(
        "/api/signup/interpret", json={"field": "name", "text": "a" * 281}
    )

    assert response.status_code == 422
