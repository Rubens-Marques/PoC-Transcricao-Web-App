"""Contrato da interpretação das respostas de cadastro.

Rodam no provider `mock` (offline, sem chave). Elas fixam a *forma* do
contrato — um SignupAnswer válido sai de texto livre — e os casos de linguagem
que motivaram trocar o parser por regex do frontend por um modelo: gíria,
flexão de gênero e resposta com contexto em volta ("casado há 20 anos").
"""

from __future__ import annotations

import pytest

from models.signup import SignupField
from services.llm_service import LLMConfigurationError, _ollama_client
from services.signup_service import (
    FIELD_PROMPTS,
    FIELD_SCHEMAS,
    MARITAL_STATUSES,
    interpret_signup_answer,
    try_fast_parse,
)


@pytest.mark.anyio
async def test_name_drops_the_sentence_around_it() -> None:
    answer = await interpret_signup_answer("name", "hi, my name is Maria Silva")
    assert answer.full_name == "Maria Silva"


@pytest.mark.anyio
async def test_email_survives_being_dictated_by_voice() -> None:
    answer = await interpret_signup_answer("email", "maria silva at gmail dot com")
    assert answer.email == "mariasilva@gmail.com"


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("single", "single"),
        ("I am single", "single"),
        ("never married", "single"),
        ("married for 20 years", "married"),
        ("I am married", "married"),
        ("we live together", "partnership"),
        ("domestic partnership", "partnership"),
        ("I separated a while ago", "divorced"),
        ("divorced", "divorced"),
        ("I have been a widow since 2010", "widowed"),
        ("I lost my husband", "widowed"),
        ("solteiro", "single"),
        ("casado há 20 anos", "married"),
    ],
)
async def test_marital_status_reads_slang_and_context(text: str, expected: str) -> None:
    answer = await interpret_signup_answer("maritalStatus", text)
    assert answer.marital_status == expected


@pytest.mark.anyio
async def test_marital_status_is_none_when_nothing_was_said() -> None:
    answer = await interpret_signup_answer("maritalStatus", "I don't know")
    assert answer.marital_status is None


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("03/15/1952", "1952-03-15"),
        ("15/03/1952", "1952-03-15"),
        ("I was born on March 15, 1952", "1952-03-15"),
        ("1952-03-15", "1952-03-15"),
    ],
)
async def test_birth_date_is_normalised_to_iso(text: str, expected: str) -> None:
    answer = await interpret_signup_answer("birthDate", text)
    assert answer.birth_date == expected


@pytest.mark.anyio
async def test_age_alone_is_reported_without_inventing_a_date() -> None:
    answer = await interpret_signup_answer("birthDate", "I am 71 years old")
    assert answer.age == 71
    assert answer.birth_date is None


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("text", "has_children", "count"),
    [
        ("I do not", False, 0),
        ("none", False, 0),
        ("I have two", True, 2),
        ("yes, 3 little ones", True, 3),
    ],
)
async def test_children_reads_count_and_absence(
    text: str, has_children: bool, count: int
) -> None:
    answer = await interpret_signup_answer("children", text)
    assert answer.has_minor_children is has_children
    assert answer.minor_children_count == count


@pytest.mark.anyio
async def test_grown_children_do_not_count_as_minors() -> None:
    answer = await interpret_signup_answer(
        "children", "I have two children, but they are grown"
    )
    assert answer.has_minor_children is False
    assert answer.minor_children_count == 0


@pytest.mark.anyio
async def test_place_splits_city_state_and_country() -> None:
    answer = await interpret_signup_answer(
        "place", "I live in Campinas, São Paulo, Brazil"
    )
    assert answer.city == "Campinas"
    assert answer.state == "São Paulo"
    assert answer.country == "Brazil"


@pytest.mark.anyio
async def test_hobbies_are_split_into_a_list() -> None:
    answer = await interpret_signup_answer(
        "hobbies", "I like walking, photography, and cooking"
    )
    assert len(answer.hobbies) >= 2


@pytest.mark.anyio
async def test_text_that_says_nothing_yields_an_empty_answer() -> None:
    answer = await interpret_signup_answer("name", "...")
    assert answer.full_name is None


@pytest.mark.anyio
async def test_single_given_name_is_not_a_full_name() -> None:
    answer = await interpret_signup_answer("name", "Maria")
    assert answer.full_name is None


def test_fast_parse_accepts_a_plain_full_name() -> None:
    answer = try_fast_parse("name", "Maria Silva")
    assert answer is not None
    assert answer.full_name == "Maria Silva"


def test_fast_parse_rejects_a_single_given_name_without_the_model() -> None:
    answer = try_fast_parse("name", "Maria")
    assert answer is not None
    assert answer.full_name is None


def test_fast_parse_accepts_a_typed_email() -> None:
    answer = try_fast_parse("email", "maria.silva@uol.com.br")
    assert answer is not None
    assert answer.email == "maria.silva@uol.com.br"


def test_fast_parse_defers_unparsed_marital_status_to_the_model() -> None:
    assert try_fast_parse("maritalStatus", "I don't know") is None


@pytest.mark.anyio
async def test_plain_answers_do_not_call_ollama(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")

    async def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("a plain answer should not call Ollama")

    monkeypatch.setattr(
        "services.signup_service._interpret_with_ollama",
        boom,
    )
    answer = await interpret_signup_answer("name", "Maria Silva")
    assert answer.full_name == "Maria Silva"


def test_every_field_has_a_schema() -> None:
    from typing import get_args

    assert set(FIELD_SCHEMAS) == set(get_args(SignupField))


def test_marital_statuses_match_the_model() -> None:
    from typing import get_args

    from models.signup import MaritalStatus

    assert set(MARITAL_STATUSES) == set(get_args(MaritalStatus))
    assert set(
        FIELD_SCHEMAS["maritalStatus"]["properties"]["marital_status"]["anyOf"][0][
            "enum"
        ]
    ) == set(  # type: ignore[index]
        MARITAL_STATUSES
    )


def test_schemas_forbid_extra_properties() -> None:
    # Structured outputs exigem `additionalProperties: false`; sem isso o
    # modelo pode inventar campos e a validação do Pydantic derruba a resposta.
    for field, schema in FIELD_SCHEMAS.items():
        assert schema["additionalProperties"] is False, field
        assert set(schema["required"]) == set(schema["properties"]), field


@pytest.mark.anyio
async def test_unreachable_ollama_is_a_configuration_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Arrange: a porta 1 é reservada e nunca escuta, então falha na hora.
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_HOST", "http://127.0.0.1:1")
    _ollama_client.cache_clear()

    # Act / Assert: daemon fora do ar é 503 (problema de operação), não 502.
    with pytest.raises(LLMConfigurationError, match="Cannot reach Ollama"):
        await interpret_signup_answer("maritalStatus", "I don't know")
    _ollama_client.cache_clear()


@pytest.mark.anyio
async def test_unknown_provider_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")

    with pytest.raises(LLMConfigurationError, match="Unsupported LLM_PROVIDER"):
        await interpret_signup_answer("maritalStatus", "I don't know")


def test_local_prompt_names_every_marital_value() -> None:
    prompt = FIELD_PROMPTS["maritalStatus"]
    for value in MARITAL_STATUSES:
        assert value in prompt
    for slang in (
        "never married",
        "live together",
        "separated",
        "widow",
        "20 years",
    ):
        assert slang in prompt
