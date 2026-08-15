"""Resposta de cadastro em linguagem natural -> SignupAnswer.

Mesmo desenho do llm_service: o modelo é um *parser*, não um interlocutor.
Recebe uma resposta e devolve um JSON preso a um schema. A diferença é que
aqui existe um schema por pergunta, e não um só para tudo — perguntar "qual é
o estado civil" com um schema de dois campos deixa um modelo de 3B muito mais
preciso do que oferecer os treze campos do cadastro de uma vez.

Providers: os mesmos três do llm_service (`ollama` local por padrão,
`anthropic` hospedado, `mock` offline para os testes).

Isto substitui o parser por regex que rodava no navegador, que quebrava em
gíria ("solteirão"), flexão ("tô solteira"), resposta com contexto ("casado há
20 anos") e e-mail ditado por voz ("maria arroba gmail ponto com").
"""

from __future__ import annotations

import logging
import os
import re
import unicodedata
from datetime import date
from typing import get_args

import ollama
from anthropic import APIError

from models.signup import MaritalStatus, SignupAnswer, SignupField
from services.llm_service import (
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_OLLAMA_HOST,
    DEFAULT_OLLAMA_MODEL,
    DEFAULT_PROVIDER,
    SUPPORTED_PROVIDERS,
    LLMConfigurationError,
    LLMExtractionError,
    _anthropic_client,
    _ollama_client,
)

logger = logging.getLogger(__name__)

MARITAL_STATUSES: list[str] = list(get_args(MaritalStatus))

FIELDS: tuple[SignupField, ...] = get_args(SignupField)


def _nullable(inner: dict[str, object]) -> dict[str, object]:
    return {"anyOf": [inner, {"type": "null"}]}


def _schema(properties: dict[str, object]) -> dict[str, object]:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


FIELD_SCHEMAS: dict[str, dict[str, object]] = {
    "name": _schema(
        {
            "full_name": _nullable(
                {"type": "string", "description": "The person's name only."}
            )
        }
    ),
    "email": _schema(
        {"email": _nullable({"type": "string", "description": "Email address."})}
    ),
    "birthDate": _schema(
        {
            "birth_date": _nullable(
                {"type": "string", "description": "Full date as YYYY-MM-DD."}
            ),
            "age": _nullable(
                {"type": "integer", "description": "Age in years, if spoken."}
            ),
        }
    ),
    "place": _schema(
        {
            "city": _nullable({"type": "string"}),
            "state": _nullable({"type": "string"}),
            "country": _nullable(
                {
                    "type": "string",
                    "description": "Country name in English.",
                }
            ),
        }
    ),
    "maritalStatus": _schema(
        {"marital_status": _nullable({"type": "string", "enum": MARITAL_STATUSES})}
    ),
    "children": _schema(
        {
            "has_minor_children": _nullable({"type": "boolean"}),
            "minor_children_count": _nullable({"type": "integer"}),
        }
    ),
    "hobbies": _schema(
        {"hobbies": {"type": "array", "items": {"type": "string"}}},
    ),
}

BASE_PROMPT = """You extract ONE fact from an older person's signup answer.
Reply in English. Field values must be English (country names, hobbies, \
marital status tokens).

Rules for every question:
- Only fill what the person actually said. Never guess. Use null when unsure.
- They speak informally, with extra words around the fact. Read the meaning, \
not the exact wording.
- The text may come from speech recognition, so it can lack punctuation and \
spell words out ("at", "dot").
Reply with a JSON object that matches the schema. No prose, no code fences."""

FIELD_PROMPTS: dict[str, str] = {
    "name": """Question asked: "What is your full name?"
Extract the full name (first and last), without the sentence around it and \
without a greeting.
A single given name is not enough: leave full_name null.
"my name is Maria Silva" -> {"full_name":"Maria Silva"}
"hi, I am Mrs. Cleusa Souza" -> {"full_name":"Cleusa Souza"}
"you can call me Joe" -> {"full_name":null}
"Maria" -> {"full_name":null}
"good morning" -> {"full_name":null}""",
    "email": """Question asked: "What is your email?"
Build the address. Spoken email uses "at" and "dot" and may have spaces — \
join it and return lowercase.
"maria at gmail dot com" -> {"email":"maria@gmail.com"}
"MARIA.SILVA@UOL.COM.BR" -> {"email":"maria.silva@uol.com.br"}
"I do not have email" -> {"email":null}""",
    "birthDate": f"""Question asked: "When were you born?"
Today is {date.today().isoformat()}.
If they gave a full date, return birth_date as YYYY-MM-DD and age null.
If they only gave an age, return age and birth_date null — NEVER invent day \
and month.
"03/15/1952" -> {{"birth_date":"1952-03-15","age":null}}
"I was born on March 15, 1952" -> {{"birth_date":"1952-03-15","age":null}}
"I am 71 years old" -> {{"birth_date":null,"age":71}}
"I am from 1950" -> {{"birth_date":null,"age":null}}""",
    "place": """Question asked: "Where do you live?"
Split city, state, and country. The country name must be in English.
If they did not say a country, assume Brazil.
"I live in Campinas, São Paulo" -> \
{"city":"Campinas","state":"São Paulo","country":"Brazil"}
"I am from Austin, Texas" -> \
{"city":"Austin","state":"Texas","country":"United States"}
"here in Lisbon, Portugal" -> \
{"city":"Lisbon","state":null,"country":"Portugal"}""",
    "maritalStatus": """Question asked: "What is your marital status?"
Pick one of the five values. Understand slang and extra context.
- single: "single", "never married", "I am single"
- married: "married", "I have been married for 20 years"
- partnership: "domestic partnership", "we live together", "civil union"
- divorced: "divorced", "I separated", "I am separated"
- widowed: "widowed", "widow", "widower", "I lost my wife"
Note: "married for 20 years" is married (they ARE married). \
"I have been a widow since 2010" is widowed.
"I don't know" -> {"marital_status":null}""",
    "children": """Question asked: "Do you have children UNDER 18?"
Count only minors.
"I do not" -> {"has_minor_children":false,"minor_children_count":0}
"I have two" -> {"has_minor_children":true,"minor_children_count":2}
"yes, 3 little ones" -> {"has_minor_children":true,"minor_children_count":3}
"I have children but they are grown" -> \
{"has_minor_children":false,"minor_children_count":0}
"my grandchildren live with me" -> {"has_minor_children":null,\
"minor_children_count":null}""",
    "hobbies": """Question asked: "What do you like to do?"
List each thing as a short English noun, capitalized.
"I like walking, photography, and cooking" -> \
{"hobbies":["Walking","Photography","Cooking"]}
"I love taking care of my garden" -> {"hobbies":["Gardening"]}
"nothing" -> {"hobbies":[]}""",
}


async def interpret_signup_answer(field: SignupField, text: str) -> SignupAnswer:
    """Entende UMA resposta do cadastro conversado."""
    if field not in FIELD_SCHEMAS:
        raise LLMConfigurationError(f"Unknown signup field: {field!r}.")

    # Resposta já estruturada (nome e sobrenome, email com @, "casado"): não
    # espera o modelo. No CPU da VPS isso é a diferença entre 50 ms e 7 s.
    fast = try_fast_parse(field, text)
    if fast is not None:
        return fast

    provider = os.environ.get("LLM_PROVIDER", DEFAULT_PROVIDER).strip().lower()

    if provider == "ollama":
        return await _interpret_with_ollama(field, text)
    if provider == "mock":
        return _interpret_with_mock(field, text)
    if provider == "anthropic":
        return await _interpret_with_anthropic(field, text)

    raise LLMConfigurationError(
        f"Unsupported LLM_PROVIDER {provider!r}. "
        f"Expected one of: {', '.join(SUPPORTED_PROVIDERS)}."
    )


def _prompt_for(field: SignupField) -> str:
    return f"{BASE_PROMPT}\n\n{FIELD_PROMPTS[field]}"


async def _interpret_with_ollama(field: SignupField, text: str) -> SignupAnswer:
    """Roda no modelo local. `format=<schema>` prende a saída ao schema, então
    o pior caso é uma leitura semanticamente errada — nunca um JSON quebrado
    nem um valor fora do enum."""
    client = _ollama_client()
    model = os.environ.get("LLM_MODEL", DEFAULT_OLLAMA_MODEL)

    try:
        response = await client.chat(
            model=model,
            messages=[
                {"role": "system", "content": _prompt_for(field)},
                {"role": "user", "content": text},
            ],
            format=FIELD_SCHEMAS[field],
            keep_alive=-1,
            # num_ctx baixo: o prompt do cadastro cabe em ~800 tokens. O default
            # do Qwen (32k) gasta CPU só para alocar a janela.
            options={"temperature": 0.0, "num_predict": 128, "num_ctx": 2048},
        )
    except ollama.ResponseError as exc:
        if exc.status_code == 404:
            raise LLMConfigurationError(
                f"Ollama has no model named {model!r}. Run: ollama pull {model}"
            ) from exc
        logger.exception("Ollama signup request failed")
        raise LLMExtractionError(f"Local model request failed: {exc}") from exc
    except (ConnectionError, OSError) as exc:
        raise LLMConfigurationError(
            f"Cannot reach Ollama at "
            f"{os.environ.get('OLLAMA_HOST', DEFAULT_OLLAMA_HOST)}. "
            "Start it with: ollama serve"
        ) from exc

    payload = response.message.content
    if not payload:
        raise LLMExtractionError("Local model returned an empty response.")

    return _clean(SignupAnswer.model_validate_json(payload))


async def _interpret_with_anthropic(field: SignupField, text: str) -> SignupAnswer:
    client = _anthropic_client()
    model = os.environ.get("LLM_MODEL", DEFAULT_ANTHROPIC_MODEL)

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=512,
            system=_prompt_for(field),
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": FIELD_SCHEMAS[field]},
            },
            messages=[{"role": "user", "content": text}],
        )
    except APIError as exc:
        logger.exception("Anthropic signup request failed")
        raise LLMExtractionError(f"LLM request failed: {exc}") from exc

    if response.stop_reason == "refusal":
        raise LLMExtractionError("The model declined to process this input.")

    payload = next((b.text for b in response.content if b.type == "text"), None)
    if payload is None:
        raise LLMExtractionError(
            f"Model returned no text block (stop_reason={response.stop_reason})."
        )

    return _clean(SignupAnswer.model_validate_json(payload))


# --- Limpeza -----------------------------------------------------------------

_MAX_TEXT = 80
_MAX_HOBBIES = 12


def _clean(answer: SignupAnswer) -> SignupAnswer:
    """Apara o que o modelo devolveu.

    O schema garante o *tipo*, não o tamanho nem a coerência: um modelo pode
    devolver o nome com 400 caracteres, ou `has_minor_children` falso com
    contagem 3. Isto é o que entra no perfil, então é aparado aqui e não na tela.
    """
    has_children = answer.has_minor_children
    count = answer.minor_children_count

    if has_children is False:
        count = 0
    elif has_children is True and (count is None or count < 1):
        count = 1
    elif has_children is None and count is not None:
        # Contagem sem o booleano: a contagem é o dado mais específico.
        has_children = count > 0
    if count is not None:
        count = max(0, min(20, count))

    return SignupAnswer(
        full_name=_trim(answer.full_name),
        email=_trim(answer.email, lower=True, max_length=120),
        birth_date=_valid_iso_date(answer.birth_date),
        age=answer.age if answer.age is not None and 0 < answer.age < 130 else None,
        city=_trim(answer.city),
        state=_trim(answer.state),
        country=_trim(answer.country),
        marital_status=answer.marital_status,
        has_minor_children=has_children,
        minor_children_count=count,
        hobbies=[
            h for h in (_trim(x, max_length=40) or "" for x in answer.hobbies) if h
        ][:_MAX_HOBBIES],
    )


def _trim(
    value: str | None, *, lower: bool = False, max_length: int = _MAX_TEXT
) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())[:max_length].strip()
    if lower:
        cleaned = cleaned.lower()
    return cleaned or None


def _valid_iso_date(value: str | None) -> str | None:
    """Rejeita data impossível ou no futuro. O schema só exige `string`, e um
    modelo pequeno erra em fevereiro."""
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    if parsed.year < 1900 or parsed > date.today():
        return None
    return parsed.isoformat()


# --- Mock provider ------------------------------------------------------------
# Heurística offline. Existe para a suíte rodar sem modelo, não como fallback:
# é justamente esta classe de parsing que o modelo veio substituir.

_NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "um": 1,
    "uma": 1,
    "dois": 2,
    "duas": 2,
    "tres": 3,
    "quatro": 4,
    "cinco": 5,
    "seis": 6,
    "sete": 7,
    "oito": 8,
    "nove": 9,
    "dez": 10,
}

_MONTH_NAMES = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

_COUNTRIES = {
    "brasil": "Brazil",
    "brazil": "Brazil",
    "portugal": "Portugal",
    "italia": "Italy",
    "italy": "Italy",
    "espanha": "Spain",
    "spain": "Spain",
    "argentina": "Argentina",
    "united states": "United States",
    "usa": "United States",
}

_NAME_PREFIXES = re.compile(
    r"^(?:hi|hello|hey|olha|olá|ola|oi|good morning|good afternoon|"
    r"good evening|bom dia|boa tarde|boa noite)?[,\s]*"
    r"(?:my\s+name\s+is|i\s+am|i'm|you\s+can\s+call\s+me|"
    r"(?:o\s+)?(?:meu\s+nome\s+(?:é|e)|me\s+chamo|pode\s+me\s+chamar\s+de|"
    r"eu\s+sou\s+(?:o|a)?|sou\s+(?:o|a)?))\s*",
    re.IGNORECASE,
)

_TITLES = re.compile(
    r"^(?:mr\.?|mrs\.?|ms\.?|miss|dona|dono|seu|sr\.?|sra\.?|senhor|senhora)\s+",
    re.IGNORECASE,
)


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def try_fast_parse(field: SignupField, text: str) -> SignupAnswer | None:
    """Parser determinístico. Só devolve resposta quando está seguro.

    `None` significa "precisa do modelo": gíria que o regex não cobre, email
    ditado de um jeito novo, frase sem cidade explícita.
    """
    parsed = _interpret_with_mock(field, text)
    if field == "name":
        # Completo ou incompleto: o modelo não inventa sobrenome.
        return parsed
    if field == "email":
        return parsed if parsed.email else None
    if field == "birthDate":
        if parsed.birth_date or parsed.age is not None:
            return parsed
        return None
    if field == "place":
        return parsed if parsed.city else None
    if field == "maritalStatus":
        return parsed if parsed.marital_status else None
    if field == "children":
        return parsed if parsed.has_minor_children is not None else None
    if parsed.hobbies:
        return parsed
    return None


def _interpret_with_mock(field: SignupField, text: str) -> SignupAnswer:
    folded = _fold(text)

    if field == "name":
        return _clean(SignupAnswer(full_name=_mock_name(text)))

    if field == "email":
        return _clean(SignupAnswer(email=_mock_email(text)))

    if field == "birthDate":
        birth_date, age = _mock_birth(text, folded)
        return _clean(SignupAnswer(birth_date=birth_date, age=age))

    if field == "place":
        city, state, country = _mock_place(text)
        return _clean(SignupAnswer(city=city, state=state, country=country))

    if field == "maritalStatus":
        return _clean(SignupAnswer(marital_status=_mock_marital(folded)))

    if field == "children":
        has_children, count = _mock_children(folded)
        return _clean(
            SignupAnswer(has_minor_children=has_children, minor_children_count=count)
        )

    return _clean(SignupAnswer(hobbies=_mock_hobbies(text)))


def _mock_name(text: str) -> str | None:
    stripped = _TITLES.sub("", _NAME_PREFIXES.sub("", text.strip()))
    cleaned = re.sub(r"[^\wÀ-ÿ\s'-]", " ", stripped).strip()
    if not cleaned:
        return None
    parts = [part for part in cleaned.split() if part]
    if len(parts) < 2:
        return None
    return cleaned


def _mock_email(text: str) -> str | None:
    direct = re.search(r"[^\s@]+@[^\s@]+\.[^\s@]+", text)
    if direct:
        return direct.group(0)
    spoken = _fold(text)
    if " at " not in spoken and " arroba " not in spoken:
        return None
    spoken = (
        spoken.replace(" at ", "@")
        .replace(" arroba ", "@")
        .replace(" dot ", ".")
        .replace(" ponto ", ".")
    )
    joined = spoken.replace(" ", "")
    return joined if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", joined) else None


def _numeric_date(first: str, second: str, year: str) -> str | None:
    left, right = int(first), int(second)
    if left > 12 and right <= 12:
        day, month = left, right
    elif right > 12 and left <= 12:
        month, day = left, right
    else:
        month, day = left, right
    if month < 1 or month > 12 or day < 1 or day > 31:
        return None
    return f"{year}-{month:02d}-{day:02d}"


def _mock_birth(text: str, folded: str) -> tuple[str | None, int | None]:
    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso:
        return iso.group(0), None

    numeric = re.search(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    if numeric:
        parsed = _numeric_date(*numeric.groups())
        if parsed:
            return parsed, None

    named = (
        re.search(r"([a-z]+)\s+(\d{1,2}),?\s+(\d{4})", folded)
        or re.search(r"(\d{1,2})\s+(?:of\s+)?([a-z]+)\s+(\d{4})", folded)
        or re.search(r"(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})", folded)
    )
    if named:
        first, second, year = named.groups()
        if first.isdigit():
            month = _MONTH_NAMES.get(second)
            day = int(first)
        else:
            month = _MONTH_NAMES.get(first)
            day = int(second)
        if month:
            return f"{year}-{month:02d}-{day:02d}", None

    age = re.search(r"(\d{1,3})\s*(?:years?(?:\s+old)?|anos)", folded)
    return None, int(age.group(1)) if age else None


def _mock_place(text: str) -> tuple[str | None, str | None, str | None]:
    parts = [part.strip() for part in text.split(",") if part.strip()]
    if not parts:
        return None, None, None

    city = re.sub(
        r"^(?:i\s+)?(?:live\s+in|am\s+from|i'm\s+from|here\s+in|"
        r"(?:eu\s+)?(?:moro\s+(?:em|no|na)|sou\s+de|aqui\s+(?:em|no|na)|em))\s+",
        "",
        parts[0],
        flags=re.IGNORECASE,
    ).strip()

    state = parts[1] if len(parts) > 1 else None
    country = "Brazil"
    if len(parts) > 2:
        country = _COUNTRIES.get(_fold(parts[2]), parts[2])
    elif state and _fold(state) in _COUNTRIES:
        country = _COUNTRIES[_fold(state)]
        state = None

    return city or None, state, country


def _mock_marital(folded: str) -> str | None:
    if re.search(
        r"widow|widower|viuv|lost (my|minha|meu) (wife|husband|esposa|marido|mulher)",
        folded,
    ):
        return "widowed"
    if re.search(r"divorced|divorci|separat|separ|desquit", folded):
        return "divorced"
    if re.search(
        r"partnership|civil union|live together|uniao estavel|moro junto|"
        r"amasiad|vivo com",
        folded,
    ):
        return "partnership"
    if "single" in folded or "solteir" in folded or "never married" in folded:
        return "single"
    if "married" in folded or "casad" in folded or re.search(r"\bcasei\b", folded):
        return "married"
    return None


def _mock_children(folded: str) -> tuple[bool | None, int | None]:
    if re.search(r"grown|adult|maior de idade|ja sao grandes|ja e grande", folded):
        return False, 0
    if re.search(
        r"\b(no|none|not|dont|nao|nenhum|nenhuma|zero)\b", folded
    ) and not re.search(r"\d", folded):
        return False, 0

    digits = re.search(r"(\d+)", folded)
    if digits:
        count = int(digits.group(1))
        return count > 0, count

    for word, value in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", folded):
            return value > 0, value

    return None, None


def _mock_hobbies(text: str) -> list[str]:
    parts = re.split(r",|\band\b|\be\b|;", text, flags=re.IGNORECASE)
    hobbies: list[str] = []
    for part in parts:
        cleaned = re.sub(
            r"^\s*(?:i\s+)?(?:like|love|enjoy|gosto|adoro|curto|amo)?"
            r"\s*(?:to\s+|de\s+|do\s+|da\s+)?",
            "",
            part,
            flags=re.IGNORECASE,
        ).strip(" .!")
        if len(cleaned) > 1:
            hobbies.append(cleaned[:1].upper() + cleaned[1:])
    return hobbies[:_MAX_HOBBIES]
