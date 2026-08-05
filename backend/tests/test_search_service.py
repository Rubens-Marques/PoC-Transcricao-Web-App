"""Search-layer behaviour: the only real logic in this PoC."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator

import pytest

from database.db import init_schema
from database.seed import seed
from models.travel import TravelPackage, TravelPreferences
from services.search_service import (
    BUDGET_WEIGHT,
    CATEGORY_WEIGHT,
    COUNTRY_WEIGHT,
    DESTINATION_WEIGHT,
    MONTH_WEIGHT,
    TRAVELERS_WEIGHT,
    score_package,
    search_packages,
)


@pytest.fixture
def connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_schema(conn)
    seed(conn)
    try:
        yield conn
    finally:
        conn.close()


def make_package(**overrides: object) -> TravelPackage:
    base = {
        "id": 1,
        "name": "Test Package",
        "destination": "Maragogi",
        "country": "Brazil",
        "category": "beach",
        "description": "Test",
        "days": 7,
        "price": 3500.0,
        "max_people": 4,
        "best_months": ["December", "January"],
    }
    return TravelPackage.model_validate({**base, **overrides})


def test_scores_zero_when_nothing_matches() -> None:
    # Arrange
    package = make_package(category="beach", best_months=["December"])
    preferences = TravelPreferences(category="cold", month="July")

    # Act
    score, reasons = score_package(package, preferences)

    # Assert
    assert score == 0
    assert reasons == []


def test_category_outweighs_month() -> None:
    # Arrange
    package = make_package()
    category_only = TravelPreferences(category="beach")
    month_only = TravelPreferences(month="December")

    # Act
    category_score, _ = score_package(package, category_only)
    month_score, _ = score_package(package, month_only)

    # Assert
    assert category_score > month_score


def test_weights_keep_destination_above_everything_else_combined() -> None:
    # Arrange / Act
    others = (
        COUNTRY_WEIGHT
        + CATEGORY_WEIGHT
        + MONTH_WEIGHT
        + BUDGET_WEIGHT
        + TRAVELERS_WEIGHT
    )

    # Assert: this is the documented invariant. Raising any other weight
    # without raising DESTINATION_WEIGHT breaks it, and this test says so.
    assert DESTINATION_WEIGHT > others


def test_named_destination_outranks_every_other_signal_combined() -> None:
    # Arrange: the named city matches nothing else; the rival matches all the rest.
    named_place = make_package(
        destination="Gramado",
        country="Narnia",
        category="city",
        best_months=["March"],
        max_people=1,
    )
    rival = make_package(
        destination="Natal",
        country="Brazil",
        category="cold",
        best_months=["December"],
        price=100.0,
    )
    preferences = TravelPreferences(
        destination="Gramado",
        country="Brazil",
        category="cold",
        month="December",
        travelers=2,
        budget_level="low",
    )

    # Act
    named_score, _ = score_package(named_place, preferences)
    rival_score, _ = score_package(rival, preferences)

    # Assert
    assert named_score > rival_score


def test_country_alone_is_enough_to_match() -> None:
    # Arrange: "I want to go to Italy" — no city, no category, nothing else.
    italian = make_package(destination="Rome", country="Italy", category="culture")
    brazilian = make_package(destination="Natal", country="Brazil", category="beach")
    preferences = TravelPreferences(country="Italy")

    # Act
    italian_score, reasons = score_package(italian, preferences)
    brazilian_score, _ = score_package(brazilian, preferences)

    # Assert
    assert italian_score == COUNTRY_WEIGHT
    assert brazilian_score == 0
    assert any("Italy" in reason for reason in reasons)


def test_country_match_outranks_category_match() -> None:
    # Arrange: naming a country is a firmer preference than naming a trip type.
    right_country = make_package(country="Italy", category="city")
    right_category = make_package(country="Brazil", category="beach")
    preferences = TravelPreferences(country="Italy", category="beach")

    # Act
    country_score, _ = score_package(right_country, preferences)
    category_score, _ = score_package(right_category, preferences)

    # Assert
    assert country_score > category_score


def test_city_and_country_both_score_when_both_are_said() -> None:
    # Arrange: "Rome, Italy" should beat a package that only matches the country.
    rome = make_package(destination="Rome", country="Italy")
    venice = make_package(destination="Venice", country="Italy")
    preferences = TravelPreferences(destination="Rome", country="Italy")

    # Act
    rome_score, _ = score_package(rome, preferences)
    venice_score, _ = score_package(venice, preferences)

    # Assert
    assert rome_score == DESTINATION_WEIGHT + COUNTRY_WEIGHT
    assert venice_score == COUNTRY_WEIGHT


def test_destination_match_ignores_case_and_accents() -> None:
    # Arrange
    package = make_package(destination="Fernando de Noronha")
    preferences = TravelPreferences(destination="fernando de noronha")

    # Act
    score, reasons = score_package(package, preferences)

    # Assert
    assert score > 0
    assert any("Destination" in reason for reason in reasons)


def test_explicit_max_budget_overrides_budget_level() -> None:
    # Arrange: "high" would allow any price, but the stated ceiling is 3000.
    package = make_package(price=9000.0)
    preferences = TravelPreferences(budget_level="high", max_budget=3000.0)

    # Act
    _, reasons = score_package(package, preferences)

    # Assert
    assert not any("budget" in reason for reason in reasons)


def test_budget_level_alone_sets_a_ceiling() -> None:
    # Arrange
    cheap = make_package(price=2500.0)
    pricey = make_package(price=8000.0)
    preferences = TravelPreferences(budget_level="low")

    # Act
    cheap_score, _ = score_package(cheap, preferences)
    pricey_score, _ = score_package(pricey, preferences)

    # Assert
    assert cheap_score > pricey_score


def test_group_larger_than_capacity_scores_no_traveler_points() -> None:
    # Arrange
    package = make_package(max_people=2)
    preferences = TravelPreferences(travelers=6)

    # Act
    score, _ = score_package(package, preferences)

    # Assert
    assert score == 0


def test_search_returns_beach_packages_for_a_december_beach_request(
    connection: sqlite3.Connection,
) -> None:
    # Arrange
    preferences = TravelPreferences(category="beach", month="December", travelers=2)

    # Act
    results = search_packages(connection, preferences)

    # Assert
    assert results
    assert results[0].category == "beach"
    assert "December" in results[0].best_months


def test_search_drops_packages_with_no_matching_criteria(
    connection: sqlite3.Connection,
) -> None:
    # Arrange
    preferences = TravelPreferences(category="cold")

    # Act
    results = search_packages(connection, preferences)

    # Assert
    assert results
    assert {result.category for result in results} == {"cold"}


def test_search_without_criteria_falls_back_to_cheapest(
    connection: sqlite3.Connection,
) -> None:
    # Arrange
    preferences = TravelPreferences()

    # Act
    results = search_packages(connection, preferences, limit=3)

    # Assert
    assert len(results) == 3
    prices = [result.price for result in results]
    assert prices == sorted(prices)


def test_search_respects_the_limit(connection: sqlite3.Connection) -> None:
    # Arrange
    preferences = TravelPreferences(travelers=1)

    # Act
    results = search_packages(connection, preferences, limit=2)

    # Assert
    assert len(results) == 2
