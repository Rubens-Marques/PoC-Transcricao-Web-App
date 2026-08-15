"""Modelos da interpretação das respostas de cadastro.

O cadastro conversado faz uma pergunta por vez, então a interpretação também é
por campo: o cliente diz qual pergunta fez, e o serviço devolve só o que aquela
pergunta pede. Um schema pequeno e focado é o que torna um modelo de 3B
confiável aqui — ver services/signup_service.py.
"""

from typing import Literal

from pydantic import BaseModel, Field

SignupField = Literal[
    "name",
    "email",
    "birthDate",
    "place",
    "maritalStatus",
    "children",
    "hobbies",
]

MaritalStatus = Literal["single", "married", "partnership", "divorced", "widowed"]


class SignupAnswer(BaseModel):
    """O que foi possível entender de UMA resposta.

    Todo campo é opcional: a resposta pode não conter o que foi perguntado, e
    inventar valor seria pior do que reperguntar.
    """

    full_name: str | None = None
    email: str | None = None
    #: Data completa em ISO (YYYY-MM-DD), só quando dia, mês e ano são conhecidos.
    birth_date: str | None = None
    #: Idade em anos, quando a pessoa deu a idade em vez da data.
    age: int | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    marital_status: MaritalStatus | None = None
    has_minor_children: bool | None = None
    minor_children_count: int | None = None
    hobbies: list[str] = Field(default_factory=list)


class SignupInterpretRequest(BaseModel):
    field: SignupField
    #: O mesmo teto do campo de conversa no cliente (LIMITS.chat).
    text: str = Field(min_length=1, max_length=280)


class SignupInterpretResponse(BaseModel):
    answer: SignupAnswer
