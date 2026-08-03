"""Deterministic scoring over travel packages.

Weights encode the priority order from the spec: category first, then month,
then budget, then group size. An explicit destination outranks all of them —
when someone names a place, that is the strongest signal they can give.

This is intentionally not a recommender: no learning, no embeddings, no
collaborative filtering. Every score is reproducible from the inputs.
"""

from __future__ import annotations

import json
import sqlite3
import unicodedata

from models.travel import Recommendation, TravelPackage, TravelPreferences

# Deliberately above the sum of every other weight: a named place beats a
# package that matches all the soft criteria but is somewhere else.
DESTINATION_WEIGHT = 200
CATEGORY_WEIGHT = 100
MONTH_WEIGHT = 50
BUDGET_WEIGHT = 25
TRAVELERS_WEIGHT = 10

DEFAULT_LIMIT = 5

# Upper bound (inclusive) of each spoken budget level, in BRL.
BUDGET_CEILINGS: dict[str, float] = {
    "low": 3000.0,
    "medium": 6000.0,
    "high": float("inf"),
}


def search_packages(
    connection: sqlite3.Connection,
    preferences: TravelPreferences,
    limit: int = DEFAULT_LIMIT,
) -> list[Recommendation]:
    """Rank every package against the preferences and return the best `limit`."""
    packages = fetch_all_packages(connection)
    has_criteria = _has_any_criteria(preferences)

    ranked: list[Recommendation] = []
    for package in packages:
        score, reasons = score_package(package, preferences)
        if has_criteria and score == 0:
            continue
        ranked.append(
            Recommendation(**package.model_dump(), score=score, match_reasons=reasons)
        )

    # Ties break on price so the cheaper trip wins — predictable for a demo.
    ranked.sort(key=lambda item: (-item.score, item.price))
    return ranked[:limit]


def score_package(
    package: TravelPackage, preferences: TravelPreferences
) -> tuple[int, list[str]]:
    """Return the package's score and a human-readable reason per matched rule."""
    score = 0
    reasons: list[str] = []

    if preferences.destination and _destination_matches(
        preferences.destination, package.destination
    ):
        score += DESTINATION_WEIGHT
        reasons.append(f"Destination matches {package.destination}")

    if preferences.category and preferences.category == package.category:
        score += CATEGORY_WEIGHT
        reasons.append(f"Category matches {package.category}")

    if preferences.month and preferences.month in package.best_months:
        score += MONTH_WEIGHT
        reasons.append(f"Good season in {preferences.month}")

    ceiling = _budget_ceiling(preferences)
    if ceiling is not None and package.price <= ceiling:
        score += BUDGET_WEIGHT
        reasons.append("Fits the stated budget")

    if preferences.travelers and package.max_people >= preferences.travelers:
        score += TRAVELERS_WEIGHT
        reasons.append(f"Fits {preferences.travelers} travelers")

    return score, reasons


def fetch_all_packages(connection: sqlite3.Connection) -> list[TravelPackage]:
    rows = connection.execute(
        """
        SELECT id, name, destination, country, category, description,
               days, price, max_people, best_months
        FROM travel_packages
        ORDER BY id
        """
    ).fetchall()
    return [_row_to_package(row) for row in rows]


def _row_to_package(row: sqlite3.Row) -> TravelPackage:
    return TravelPackage(
        id=row["id"],
        name=row["name"],
        destination=row["destination"],
        country=row["country"],
        category=row["category"],
        description=row["description"],
        days=row["days"],
        price=row["price"],
        max_people=row["max_people"],
        best_months=json.loads(row["best_months"]),
    )


def _budget_ceiling(preferences: TravelPreferences) -> float | None:
    """An explicit amount always wins over the coarse level."""
    if preferences.max_budget is not None:
        return preferences.max_budget
    if preferences.budget_level is not None:
        return BUDGET_CEILINGS[preferences.budget_level]
    return None


def _destination_matches(spoken: str, package_destination: str) -> bool:
    spoken_key = _normalize(spoken)
    package_key = _normalize(package_destination)
    if not spoken_key or not package_key:
        return False
    return spoken_key in package_key or package_key in spoken_key


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.strip().casefold())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _has_any_criteria(preferences: TravelPreferences) -> bool:
    return any(
        value is not None
        for value in (
            preferences.destination,
            preferences.category,
            preferences.month,
            preferences.travelers,
            preferences.budget_level,
            preferences.max_budget,
        )
    )
