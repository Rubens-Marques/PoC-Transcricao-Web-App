"""Extraction contract, exercised through the offline mock provider.

These assert the shape of the pipeline (a valid TravelPreferences comes out of
free text), not the quality of a hosted model's understanding.
"""

from __future__ import annotations

import pytest

from models.travel import TravelPreferences
from services.llm_service import (
    PREFERENCES_SCHEMA,
    LLMConfigurationError,
    extract_travel_preferences,
)


@pytest.mark.anyio
async def test_extracts_category_and_month_from_english() -> None:
    # Arrange
    text = "I want to travel to a beach destination in December"

    # Act
    preferences = await extract_travel_preferences(text)

    # Assert
    assert preferences.category == "beach"
    assert preferences.month == "December"


@pytest.mark.anyio
async def test_extracts_from_portuguese_with_accents() -> None:
    # Arrange
    text = "Quero uma viagem para a praia em janeiro"

    # Act
    preferences = await extract_travel_preferences(text)

    # Assert
    assert preferences.category == "beach"
    assert preferences.month == "January"


@pytest.mark.anyio
async def test_stated_amount_sets_both_budget_fields() -> None:
    # Arrange
    text = "Beach trip in December with my wife, budget around 5000 reais"

    # Act
    preferences = await extract_travel_preferences(text)

    # Assert
    assert preferences.max_budget == 5000.0
    assert preferences.budget_level == "medium"
    assert preferences.travelers == 2


@pytest.mark.anyio
async def test_unmentioned_fields_stay_null() -> None:
    # Arrange
    text = "I want to go somewhere"

    # Act
    preferences = await extract_travel_preferences(text)

    # Assert
    assert preferences == TravelPreferences()


@pytest.mark.anyio
async def test_unknown_provider_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Arrange
    monkeypatch.setenv("LLM_PROVIDER", "gemini")

    # Act / Assert
    with pytest.raises(LLMConfigurationError, match="Unsupported LLM_PROVIDER"):
        await extract_travel_preferences("beach in December")


def test_schema_requires_every_field_and_forbids_extras() -> None:
    # Arrange / Act
    required = set(PREFERENCES_SCHEMA["required"])
    properties = set(PREFERENCES_SCHEMA["properties"])

    # Assert: structured outputs reject a schema where these drift apart.
    assert required == properties
    assert PREFERENCES_SCHEMA["additionalProperties"] is False


def test_schema_fields_match_the_pydantic_model() -> None:
    # Arrange / Act
    schema_fields = set(PREFERENCES_SCHEMA["properties"])
    model_fields = set(TravelPreferences.model_fields)

    # Assert
    assert schema_fields == model_fields
