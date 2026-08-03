"""Domain models shared by the LLM extraction layer and the HTTP API."""

from typing import Literal

from pydantic import BaseModel, Field

TravelCategory = Literal[
    "beach",
    "cold",
    "city",
    "adventure",
    "culture",
    "nature",
]

BudgetLevel = Literal["low", "medium", "high"]

Month = Literal[
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


class TravelPreferences(BaseModel):
    """Structured output of the LLM layer. Every field is optional because a
    single spoken sentence rarely mentions all of them."""

    destination: str | None = None
    category: TravelCategory | None = None
    month: Month | None = None
    travelers: int | None = None
    budget_level: BudgetLevel | None = None
    max_budget: float | None = None


class TravelPackage(BaseModel):
    id: int
    name: str
    destination: str
    country: str
    category: str
    description: str
    days: int
    price: float
    max_people: int
    best_months: list[str]


class Recommendation(TravelPackage):
    """A package plus why the search layer ranked it where it did."""

    score: int
    match_reasons: list[str]


class RecommendationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class RecommendationResponse(BaseModel):
    preferences: TravelPreferences
    recommendations: list[Recommendation]
