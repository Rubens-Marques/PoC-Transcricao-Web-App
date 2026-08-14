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
                {"type": "string", "description": "Só o nome da pessoa."}
            )
        }
    ),
    "email": _schema(
        {"email": _nullable({"type": "string", "description": "Endereço de email."})}
    ),
    "birthDate": _schema(
        {
            "birth_date": _nullable(
                {"type": "string", "description": "Data completa em YYYY-MM-DD."}
            ),
            "age": _nullable(
                {"type": "integer", "description": "Idade em anos, se dita."}
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
                    "description": "Nome do país em português.",
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

BASE_PROMPT = """Você extrai UMA informação da resposta de uma pessoa idosa \
num cadastro em português do Brasil.

Regras que valem para todas as perguntas:
- Só preencha o que a pessoa realmente disse. Nunca chute. Use null quando não der.
- A pessoa fala informalmente, com gíria e com frase em volta. Entenda o sentido, \
não a palavra exata.
- O texto pode vir de reconhecimento de fala, então pode estar sem pontuação e \
com palavras escritas por extenso.
Responda apenas com um objeto JSON do schema. Sem prosa, sem cercas de código."""

FIELD_PROMPTS: dict[str, str] = {
    "name": """Pergunta feita: "Qual o seu nome completo?"
Extraia o nome completo (nome e sobrenome), sem a frase em volta e sem saudação.
Um só nome não basta: deixe full_name nulo.
"meu nome é Maria Silva" -> {"full_name":"Maria Silva"}
"olha, eu sou a Dona Cleusa Souza" -> {"full_name":"Cleusa Souza"}
"pode me chamar de Zé" -> {"full_name":null}
"Maria" -> {"full_name":null}
"bom dia" -> {"full_name":null}""",
    "email": """Pergunta feita: "Qual é o seu email?"
Monte o endereço. Ditado por voz vem com "arroba" e "ponto" por extenso e com \
espaços no meio — junte tudo e devolva em minúsculas.
"maria arroba gmail ponto com" -> {"email":"maria@gmail.com"}
"MARIA.SILVA@UOL.COM.BR" -> {"email":"maria.silva@uol.com.br"}
"não tenho email" -> {"email":null}""",
    "birthDate": f"""Pergunta feita: "Quando você nasceu?"
Hoje é {date.today().isoformat()}.
Se a pessoa deu a data completa, devolva birth_date em YYYY-MM-DD e age null.
Se deu só a idade, devolva age e birth_date null — NUNCA invente dia e mês.
"15/03/1952" -> {{"birth_date":"1952-03-15","age":null}}
"nasci em 15 de março de 1952" -> {{"birth_date":"1952-03-15","age":null}}
"tenho 71 anos" -> {{"birth_date":null,"age":71}}
"sou de 1950" -> {{"birth_date":null,"age":null}}""",
    "place": """Pergunta feita: "Onde você mora?"
Separe cidade, estado e país. Este é o endereço da pessoa e vai ser mostrado \
para ela, então o país sai em PORTUGUÊS.
Se a pessoa não disse o país, assuma Brasil.
"moro em Campinas, São Paulo" -> \
{"city":"Campinas","state":"São Paulo","country":"Brasil"}
"sou de Belo Horizonte, Minas" -> \
{"city":"Belo Horizonte","state":"Minas Gerais","country":"Brasil"}
"aqui em Lisboa, Portugal" -> \
{"city":"Lisboa","state":null,"country":"Portugal"}""",
    "maritalStatus": """Pergunta feita: "Qual é o seu estado civil?"
Escolha um dos cinco valores. Entenda gíria, flexão de gênero e frase com contexto.
- solteiro: "solteiro", "solteira", "solteirão", "nunca casei", "tô solteira"
- casado: "casado", "casada", "casado há 20 anos", "sou casado sim"
- uniao: "união estável", "moro junto", "amasiado", "vivo com meu companheiro"
- divorciado: "divorciado", "divorciada", "me separei", "sou separada", \
"desquitado", "desquitada" (termo antigo para separação judicial, comum entre \
quem casou antes de 1977 — NÃO confundir com viuvez)
- viuvo: "viúvo", "viúva", "perdi minha esposa", "sou viúva desde 2010"
Atenção: "casado há 20 anos" é casado (a pessoa É casada). \
"sou viúva desde 2010" é viuvo.
"sei lá" -> {"marital_status":null}""",
    "children": """Pergunta feita: "Você tem filhos MENORES de 18 anos?"
Conte apenas os menores de idade.
"não tenho" -> {"has_minor_children":false,"minor_children_count":0}
"tenho dois" -> {"has_minor_children":true,"minor_children_count":2}
"sim, 3 pequenos" -> {"has_minor_children":true,"minor_children_count":3}
"tenho filhos mas já são adultos" -> \
{"has_minor_children":false,"minor_children_count":0}
"meus netos moram comigo" -> {"has_minor_children":null,\
"minor_children_count":null}""",
    "hobbies": """Pergunta feita: "O que você gosta de fazer?"
Liste cada coisa como um item curto, em substantivo e com inicial maiúscula.
"gosto de caminhar, de fotografia e de cozinhar" -> \
{"hobbies":["Caminhada","Fotografia","Culinária"]}
"adoro cuidar do meu jardim" -> {"hobbies":["Jardim"]}
"nada" -> {"hobbies":[]}""",
}


async def interpret_signup_answer(field: SignupField, text: str) -> SignupAnswer:
    """Entende UMA resposta do cadastro conversado."""
    if field not in FIELD_SCHEMAS:
        raise LLMConfigurationError(f"Campo de cadastro desconhecido: {field!r}.")

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
    "brasil": "Brasil",
    "brazil": "Brasil",
    "portugal": "Portugal",
    "italia": "Itália",
    "espanha": "Espanha",
    "argentina": "Argentina",
}

_NAME_PREFIXES = re.compile(
    r"^(?:olha|olá|ola|oi|bom dia|boa tarde|boa noite)?[,\s]*"
    r"(?:o\s+)?(?:meu\s+nome\s+(?:é|e)|me\s+chamo|pode\s+me\s+chamar\s+de|"
    r"eu\s+sou\s+(?:o|a)?|sou\s+(?:o|a)?)\s*",
    re.IGNORECASE,
)

_TITLES = re.compile(
    r"^(?:dona|dono|seu|sr\.?|sra\.?|senhor|senhora)\s+", re.IGNORECASE
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
    # Ditado por voz: "maria silva arroba gmail ponto com".
    spoken = _fold(text)
    if " arroba " not in spoken:
        return None
    spoken = spoken.replace(" arroba ", "@").replace(" ponto ", ".")
    joined = spoken.replace(" ", "")
    return joined if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", joined) else None


def _mock_birth(text: str, folded: str) -> tuple[str | None, int | None]:
    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso:
        return iso.group(0), None

    numeric = re.search(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    if numeric:
        day, month, year = numeric.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}", None

    named = re.search(r"(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})", folded)
    if named:
        day, month_name, year = named.groups()
        month = _MONTH_NAMES.get(month_name)
        if month:
            return f"{year}-{month:02d}-{int(day):02d}", None

    age = re.search(r"(\d{1,3})\s*anos", folded)
    return None, int(age.group(1)) if age else None


def _mock_place(text: str) -> tuple[str | None, str | None, str | None]:
    parts = [part.strip() for part in text.split(",") if part.strip()]
    if not parts:
        return None, None, None

    city = re.sub(
        r"^(?:eu\s+)?(?:moro\s+(?:em|no|na)|sou\s+de|aqui\s+(?:em|no|na)|em)\s+",
        "",
        parts[0],
        flags=re.IGNORECASE,
    ).strip()

    state = parts[1] if len(parts) > 1 else None
    country = "Brasil"
    if len(parts) > 2:
        country = _COUNTRIES.get(_fold(parts[2]), parts[2])
    elif state and _fold(state) in _COUNTRIES:
        country = _COUNTRIES[_fold(state)]
        state = None

    return city or None, state, country


def _mock_marital(folded: str) -> str | None:
    if re.search(r"viuv|perdi (minha|meu) (esposa|marido|mulher)", folded):
        return "viuvo"
    if re.search(r"divorci|separ|desquit", folded):
        return "divorciado"
    if re.search(r"uniao estavel|moro junto|amasiad|vivo com", folded):
        return "uniao"
    if "solteir" in folded:
        return "solteiro"
    if "casad" in folded or re.search(r"\bcasei\b", folded):
        return "casado"
    return None


def _mock_children(folded: str) -> tuple[bool | None, int | None]:
    if re.search(r"adult|maior de idade|ja sao grandes|ja e grande", folded):
        return False, 0
    if re.search(r"\b(nao|nenhum|nenhuma|zero)\b", folded) and not re.search(
        r"\d", folded
    ):
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
    parts = re.split(r",|\be\b|;", text, flags=re.IGNORECASE)
    hobbies: list[str] = []
    for part in parts:
        cleaned = re.sub(
            r"^\s*(?:eu\s+)?(?:gosto|adoro|curto|amo)?\s*(?:de\s+|do\s+|da\s+)?",
            "",
            part,
            flags=re.IGNORECASE,
        ).strip(" .!")
        if len(cleaned) > 1:
            hobbies.append(cleaned[:1].upper() + cleaned[1:])
    return hobbies[:_MAX_HOBBIES]
