"""Estação -> mês, a inferência que foi tirada do modelo.

Medido em 2026-08-05: instruído a aplicar o hemisfério conforme o país, o
`qwen2.5:3b` respondia "verão" -> June e "inverno" -> July para qualquer país.
Estes testes cobrem o que o código passou a decidir no lugar dele.
"""

from __future__ import annotations

import pytest

from models.travel import TravelPreferences
from services.season import is_southern, month_for_season, resolve_season


@pytest.mark.parametrize(
    ("season", "country", "expected"),
    [
        ("summer", "Brazil", "January"),
        ("summer", "Portugal", "July"),
        ("winter", "Brazil", "July"),
        ("winter", "Italy", "January"),
        ("spring", "Brazil", "October"),
        ("spring", "Japan", "April"),
        ("autumn", "Argentina", "April"),
        ("autumn", "France", "October"),
    ],
)
def test_same_season_gives_opposite_months_across_hemispheres(
    season: str, country: str, expected: str
) -> None:
    # Arrange / Act
    got = month_for_season(season, country)  # type: ignore[arg-type]

    # Assert
    assert got == expected


def test_unknown_country_defaults_to_southern() -> None:
    # Arrange / Act / Assert: o falante é brasileiro; sul é o palpite certo.
    assert is_southern(None) is True
    assert is_southern("Narnia") is True
    assert month_for_season("summer", None) == "January"


def test_country_match_ignores_case_and_spacing() -> None:
    # Arrange / Act / Assert
    assert is_southern("  bRaZiL ") is True
    assert is_southern("Italy") is False


def test_explicit_month_beats_season() -> None:
    # Arrange: "julho, no verão" — o mês dito vence.
    preferences = TravelPreferences(month="July", season="summer", country="Brazil")

    # Act
    resolved = resolve_season(preferences)

    # Assert
    assert resolved.month == "July"


def test_season_fills_the_month_when_none_was_said() -> None:
    # Arrange
    preferences = TravelPreferences(season="summer", country="Portugal")

    # Act
    resolved = resolve_season(preferences)

    # Assert
    assert resolved.month == "July"
    assert resolved.season == "summer"


def test_no_season_leaves_preferences_untouched() -> None:
    # Arrange
    preferences = TravelPreferences(category="beach")

    # Act
    resolved = resolve_season(preferences)

    # Assert
    assert resolved == preferences
