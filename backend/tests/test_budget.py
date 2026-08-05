"""Valor -> faixa de orçamento, a segunda inferência tirada do modelo.

Medido em 2026-08-05: com o exemplo literal `5000 is "medium"` no prompt, o
`qwen2.5:3b` devolveu "low" para "tenho uns 5000 reais". Comparação de dois
números não é trabalho de modelo.
"""

from __future__ import annotations

import pytest

from models.travel import TravelPreferences
from services.budget import (
    BUDGET_CEILINGS,
    LOW_MAX,
    MEDIUM_MAX,
    level_for_amount,
    resolve_budget,
)


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        (500.0, "low"),
        (2999.99, "low"),
        (3000.0, "medium"),  # fronteira inclusiva
        (5000.0, "medium"),  # o caso que o modelo errou
        (6000.0, "medium"),  # fronteira inclusiva
        (6000.01, "high"),
        (50000.0, "high"),
    ],
)
def test_level_for_amount_at_and_around_the_boundaries(
    amount: float, expected: str
) -> None:
    # Arrange / Act / Assert
    assert level_for_amount(amount) == expected


def test_stated_amount_overrides_whatever_the_model_said() -> None:
    # Arrange: o caso real — 5000 classificado como "low" pelo modelo.
    preferences = TravelPreferences(max_budget=5000.0, budget_level="low")

    # Act
    resolved = resolve_budget(preferences)

    # Assert
    assert resolved.budget_level == "medium"
    assert resolved.max_budget == 5000.0


def test_level_from_words_alone_is_left_untouched() -> None:
    # Arrange: "quero algo barato" — sem número, o modelo é quem sabe.
    preferences = TravelPreferences(budget_level="low")

    # Act
    resolved = resolve_budget(preferences)

    # Assert
    assert resolved == preferences


def test_ceilings_agree_with_the_level_boundaries() -> None:
    # Arrange / Act / Assert: os dois caminhos usam as mesmas fronteiras, e
    # divergir silenciosamente faria a busca filtrar por uma faixa e a extração
    # classificar por outra.
    assert BUDGET_CEILINGS["low"] == LOW_MAX
    assert BUDGET_CEILINGS["medium"] == MEDIUM_MAX
    assert BUDGET_CEILINGS["high"] == float("inf")
    assert level_for_amount(BUDGET_CEILINGS["low"]) == "medium"
