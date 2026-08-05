"""Natural language -> TravelPreferences.

The LLM here is a parser, not a conversationalist: it receives one sentence and
returns one JSON object matching PREFERENCES_SCHEMA.

Every provider constrains generation with the same JSON Schema, so none of them
ever needs repair prompting:

- `ollama`    — a small instruct model on the local machine. The default.
                Constrained decoding via `format=<schema>`. Nothing leaves the host.
- `anthropic` — the hosted Messages API, via `output_config.format`.
- `mock`      — keyword matching, for offline tests. Not a fallback.
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from typing import get_args

import ollama
from anthropic import APIError, AsyncAnthropic

from models.travel import BudgetLevel, Month, TravelCategory, TravelPreferences

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "ollama"
DEFAULT_ANTHROPIC_MODEL = "claude-opus-5"
DEFAULT_OLLAMA_MODEL = "qwen2.5:3b"
DEFAULT_OLLAMA_HOST = "http://localhost:11434"

SUPPORTED_PROVIDERS = ("ollama", "anthropic", "mock")

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
        "country": _nullable(
            {
                "type": "string",
                "description": "Country named by the user, in English.",
            }
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
        "country",
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
- `destination` and `country` are separate fields. Split what the speaker said \
across them; never merge them into one.
  - "Gramado" -> destination "Gramado", country null (they did not say the country)
  - "Italy" -> country "Italy", destination null (they did not say a city)
  - "Rome, Italy" -> destination "Rome", country "Italy"
- `country` is always the English name: "Itália" -> "Italy", "Espanha" -> "Spain", \
"Brasil" -> "Brazil"."""

# A 3B model needs the rules spelled out where a frontier model infers them.
# Every addition below fixes a failure observed on qwen2.5:3b with the base
# prompt: category words leaking into `destination`, budget bands applied by
# vibe instead of arithmetic, southern-hemisphere seasons read as northern, and
# `travelers` defaulting to 1 when nobody was mentioned. The worked examples
# matter more than the prose — small models copy patterns better than they
# follow instructions.
OLLAMA_SYSTEM_PROMPT = (
    SYSTEM_PROMPT
    + """
- `destination` must be a PROPER NOUN naming a real city or region ("Gramado",
"Natal", "Patagonia"). A kind of place is NOT a destination: "praia", "beach",
"montanha", "mountains", "campo" all mean destination is null — they only set
`category`.
- A COUNTRY never goes in `destination`. "Italy", "Japan", "Portugal" go in
`country`, with `destination` null. Naming a country is a real preference —
never drop it.
- `travelers` is null unless the speaker mentions who is going. Never default to
1. Use 1 only for an explicit "alone" / "sozinho".
- When counting `travelers`, ALWAYS add the speaker to the people they name. Do
the sum explicitly: "com minha esposa" = 1 speaker + 1 wife = 2. "com minha
esposa e dois filhos" = 1 + 1 + 2 = 4. "eu e mais três amigos" = 1 + 3 = 4.
- Seasons depend on the HEMISPHERE of the place being discussed. Pick the middle
month of the season.
  - Southern (Brazil, Argentina, Chile, Peru, Australia): "verão"/"summer" is
    December-February, "inverno"/"winter" is June-August.
  - Northern (Italy, France, Spain, Portugal, Japan, United States, Europe in
    general): "verão"/"summer" is June-August, "inverno"/"winter" is
    December-February.
  - If no place was named, assume southern — the speaker is Brazilian.
  - "verão em Portugal" -> July. "verão no Brasil" -> January.
- `budget_level` from an amount is arithmetic, not opinion: below 3000 is "low",
3000 to 6000 inclusive is "medium", above 6000 is "high". 5000 is "medium".
- If the speaker says they do NOT want something ("não quero praia", "anything
but the beach"), leave that field null. Never fill it with the rejected value.

Worked examples:

"Quero uma praia em dezembro com minha esposa, uns 5000 reais"
{"destination":null,"country":null,"category":"beach","month":"December",\
"travelers":2,"budget_level":"medium","max_budget":5000}

"Quero conhecer Gramado no inverno"
{"destination":"Gramado","country":null,"category":"cold","month":"July",\
"travelers":null,"budget_level":null,"max_budget":null}

"I want to go to Italy with my wife"
{"destination":null,"country":"Italy","category":null,"month":null,\
"travelers":2,"budget_level":null,"max_budget":null}

"quero passar uma semana em Roma, na Itália"
{"destination":"Rome","country":"Italy","category":null,"month":null,\
"travelers":null,"budget_level":null,"max_budget":null}

"quero ir pra algum lugar"
{"destination":null,"country":null,"category":null,"month":null,\
"travelers":null,"budget_level":null,"max_budget":null}

Reply only with a JSON object matching the schema. No prose, no code fences."""
)


@lru_cache(maxsize=1)
def _anthropic_client() -> AsyncAnthropic:
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        raise LLMConfigurationError(
            "LLM_API_KEY is not set. Copy backend/.env.example to backend/.env and "
            "fill it in, or set LLM_PROVIDER=ollama to run a local model instead."
        )
    return AsyncAnthropic(api_key=api_key)


@lru_cache(maxsize=1)
def _ollama_client() -> ollama.AsyncClient:
    return ollama.AsyncClient(host=os.environ.get("OLLAMA_HOST", DEFAULT_OLLAMA_HOST))


async def extract_travel_preferences(text: str) -> TravelPreferences:
    """Turn one natural-language sentence into structured preferences."""
    provider = os.environ.get("LLM_PROVIDER", DEFAULT_PROVIDER).strip().lower()

    if provider == "ollama":
        return await _extract_with_ollama(text)
    if provider == "mock":
        return _extract_with_mock(text)
    if provider == "anthropic":
        return await _extract_with_anthropic(text)

    raise LLMConfigurationError(
        f"Unsupported LLM_PROVIDER {provider!r}. "
        f"Expected one of: {', '.join(SUPPORTED_PROVIDERS)}."
    )


async def _extract_with_ollama(text: str) -> TravelPreferences:
    """Run the extraction on a locally hosted model.

    `format=PREFERENCES_SCHEMA` makes Ollama restrict token sampling to what the
    schema permits, which is what makes a 3B model usable here: the output cannot
    be malformed JSON or an invented enum value. Only the *semantics* can be
    wrong — see DOCUMENTACAO.md §7.7.
    """
    client = _ollama_client()
    model = os.environ.get("LLM_MODEL", DEFAULT_OLLAMA_MODEL)

    try:
        response = await client.chat(
            model=model,
            messages=[
                {"role": "system", "content": OLLAMA_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            format=PREFERENCES_SCHEMA,
            # Extraction must be reproducible: the same sentence has to yield the
            # same fields on every run, or the demo looks unreliable.
            options={"temperature": 0.0, "num_predict": 256},
        )
    except ollama.ResponseError as exc:
        if exc.status_code == 404:
            raise LLMConfigurationError(
                f"Ollama has no model named {model!r}. Run: ollama pull {model}"
            ) from exc
        logger.exception("Ollama request failed")
        raise LLMExtractionError(f"Local model request failed: {exc}") from exc
    except (ConnectionError, OSError) as exc:
        # httpx.ConnectError subclasses OSError; treat an unreachable daemon as a
        # misconfigured deployment (503), not a bad model answer (502).
        raise LLMConfigurationError(
            f"Cannot reach Ollama at {os.environ.get('OLLAMA_HOST', DEFAULT_OLLAMA_HOST)}. "
            "Start it with: ollama serve"
        ) from exc

    payload = response.message.content
    if not payload:
        raise LLMExtractionError("Local model returned an empty response.")

    return TravelPreferences.model_validate_json(payload)


async def _extract_with_anthropic(text: str) -> TravelPreferences:
    client = _anthropic_client()
    model = os.environ.get("LLM_MODEL", DEFAULT_ANTHROPIC_MODEL)

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

# Só os países presentes no catálogo — o mock não pretende cobrir o mundo.
_COUNTRY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Brazil": ("brazil", "brasil"),
    "Italy": ("italy", "italia"),
    "France": ("france", "franca"),
    "Portugal": ("portugal",),
    "Spain": ("spain", "espanha"),
    "Japan": ("japan", "japao"),
    "Argentina": ("argentina",),
    "Chile": ("chile",),
    "Peru": ("peru",),
    "United States": ("united states", "estados unidos", "eua", "usa"),
}


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

    country = next(
        (
            name
            for name, words in _COUNTRY_KEYWORDS.items()
            if _contains(haystack, words)
        ),
        None,
    )

    return TravelPreferences.model_validate(
        {
            "destination": None,
            "country": country,
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
