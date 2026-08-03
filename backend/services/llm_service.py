"""Natural language -> TravelPreferences.

The LLM here is a parser, not a conversationalist: it receives one sentence and
returns one JSON object matching PREFERENCES_SCHEMA. Schema conformance is
enforced server-side by the Messages API (`output_config.format`), so the
response never needs repair prompting.
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from typing import get_args

from anthropic import APIError, AsyncAnthropic

from models.travel import BudgetLevel, Month, TravelCategory, TravelPreferences

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-opus-5"

CATEGORIES: list[str] = list(get_args(TravelCategory))
MONTHS: list[str] = list(get_args(Month))
BUDGET_LEVELS: list[str] = list(get_args(BudgetLevel))


class LLMConfigurationError(RuntimeError):
    """Raised when the provider is missing credentials or is not supported."""


class LLMExtractionError(RuntimeError):
    """Raised when the provider answered but the answer is unusable."""


def _nullable(inner: dict[str, object]) -> dict[str, object]:
    return {"anyOf": [inner, {"type": "null"}]}


# Structured outputs require every property in `required` and
# `additionalProperties: false`; optionality is expressed by allowing null.
PREFERENCES_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "destination": _nullable(
            {"type": "string", "description": "City or region named by the user."}
        ),
        "category": _nullable({"type": "string", "enum": CATEGORIES}),
        "month": _nullable({"type": "string", "enum": MONTHS}),
        "travelers": _nullable(
            {
                "type": "integer",
                "description": "Total people travelling, user included.",
            }
        ),
        "budget_level": _nullable({"type": "string", "enum": BUDGET_LEVELS}),
        "max_budget": _nullable(
            {"type": "number", "description": "Explicit ceiling in BRL, if stated."}
        ),
    },
    "required": [
        "destination",
        "category",
        "month",
        "travelers",
        "budget_level",
        "max_budget",
    ],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You extract travel preferences from a single spoken sentence.

The speaker may use Portuguese or English. Your output values are always the \
canonical English tokens defined by the schema, regardless of input language.

Rules:
- Only fill a field the speaker actually expressed. Never guess. Use null otherwise.
- `category` describes the kind of trip: beach, cold (mountain/winter), city, \
adventure, culture, nature.
- `travelers` counts every person on the trip. "with my wife" is 2, \
"with my wife and two kids" is 4, "alone" is 1.
- `max_budget` is only set when a number is stated (e.g. "up to 5000 reais" -> 5000). \
A stated number also implies a `budget_level`: under 3000 is low, 3000-6000 is \
medium, above 6000 is high.
- `budget_level` may also come from words alone: "cheap"/"barato" -> low, \
"luxury"/"luxuoso" -> high.
- `destination` is the place name only, without the country ("Gramado", not \
"Gramado, Brazil")."""


@lru_cache(maxsize=1)
def _anthropic_client() -> AsyncAnthropic:
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        raise LLMConfigurationError(
            "LLM_API_KEY is not set. Copy backend/.env.example to backend/.env and "
            "fill it in, or set LLM_PROVIDER=mock to run without a key."
        )
    return AsyncAnthropic(api_key=api_key)


async def extract_travel_preferences(text: str) -> TravelPreferences:
    """Turn one natural-language sentence into structured preferences."""
    provider = os.environ.get("LLM_PROVIDER", "anthropic").strip().lower()

    if provider == "mock":
        return _extract_with_mock(text)
    if provider == "anthropic":
        return await _extract_with_anthropic(text)

    raise LLMConfigurationError(
        f"Unsupported LLM_PROVIDER {provider!r}. Expected 'anthropic' or 'mock'."
    )


async def _extract_with_anthropic(text: str) -> TravelPreferences:
    client = _anthropic_client()
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            # Extraction is shallow work: low effort keeps the voice loop snappy.
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": PREFERENCES_SCHEMA},
            },
            messages=[{"role": "user", "content": text}],
        )
    except APIError as exc:
        logger.exception("Anthropic request failed")
        raise LLMExtractionError(f"LLM request failed: {exc}") from exc

    if response.stop_reason == "refusal":
        raise LLMExtractionError("The model declined to process this input.")

    payload = next((b.text for b in response.content if b.type == "text"), None)
    if payload is None:
        raise LLMExtractionError(
            f"Model returned no text block (stop_reason={response.stop_reason})."
        )

    return TravelPreferences.model_validate_json(payload)


# --- Mock provider ------------------------------------------------------------
# Keyword matching, good enough to demo the end-to-end flow with no API key.

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "beach": ("beach", "praia", "praias", "mar", "litoral", "sol"),
    "cold": ("cold", "frio", "neve", "snow", "inverno", "winter", "montanha"),
    "city": ("city", "cidade", "urbano", "metropole", "shopping"),
    "adventure": ("adventure", "aventura", "trilha", "trekking", "rafting", "radical"),
    "culture": ("culture", "cultura", "historico", "historia", "museu", "colonial"),
    "nature": ("nature", "natureza", "ecoturismo", "cachoeira", "floresta", "parque"),
}

_MONTH_KEYWORDS: dict[str, tuple[str, ...]] = {
    "January": ("january", "janeiro"),
    "February": ("february", "fevereiro"),
    "March": ("march", "marco"),
    "April": ("april", "abril"),
    "May": ("may", "maio"),
    "June": ("june", "junho"),
    "July": ("july", "julho"),
    "August": ("august", "agosto"),
    "September": ("september", "setembro"),
    "October": ("october", "outubro"),
    "November": ("november", "novembro"),
    "December": ("december", "dezembro"),
}

_LOW_BUDGET_WORDS = ("cheap", "barato", "economico", "budget")
_HIGH_BUDGET_WORDS = ("luxury", "luxuoso", "premium", "sofisticado")


def _extract_with_mock(text: str) -> TravelPreferences:
    haystack = _strip_accents(text).lower()

    category = next(
        (
            name
            for name, words in _CATEGORY_KEYWORDS.items()
            if _contains(haystack, words)
        ),
        None,
    )
    month = next(
        (name for name, words in _MONTH_KEYWORDS.items() if _contains(haystack, words)),
        None,
    )

    travelers = (
        2
        if _contains(haystack, ("wife", "husband", "esposa", "marido", "namorad"))
        else None
    )
    if _contains(haystack, ("alone", "sozinho", "sozinha")):
        travelers = 1

    max_budget: float | None = None
    amount = re.search(r"(\d[\d.,]*)\s*(reais|reals|brl|r\$)", haystack)
    if amount:
        max_budget = float(amount.group(1).replace(".", "").replace(",", "."))

    budget_level: str | None = None
    if max_budget is not None:
        budget_level = (
            "low" if max_budget < 3000 else "medium" if max_budget <= 6000 else "high"
        )
    elif _contains(haystack, _LOW_BUDGET_WORDS):
        budget_level = "low"
    elif _contains(haystack, _HIGH_BUDGET_WORDS):
        budget_level = "high"

    return TravelPreferences.model_validate(
        {
            "destination": None,
            "category": category,
            "month": month,
            "travelers": travelers,
            "budget_level": budget_level,
            "max_budget": max_budget,
        }
    )


def _contains(haystack: str, needles: tuple[str, ...]) -> bool:
    return any(needle in haystack for needle in needles)


def _strip_accents(value: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))
