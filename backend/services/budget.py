"""Faixas de orçamento — fonte única para extração e busca.

`budget_level` a partir de um valor é aritmética pura, e o `qwen2.5:3b` erra:
na avaliação de 2026-08-05 respondeu "low" para 5000 mesmo com o exemplo
literal `5000 is "medium"` no prompt. Um modelo não deve ser consultado sobre
uma comparação de dois números.

As mesmas fronteiras servem para dois usos opostos, e por isso moram juntas:
derivar o nível a partir de um valor (aqui) e derivar um teto a partir do nível
(`search_service`). Separá-las convidaria a divergirem.
"""

from __future__ import annotations

from models.travel import BudgetLevel, TravelPreferences

# Fronteiras em BRL. `medium` é inclusivo nos dois extremos: 3000 e 6000 são
# "medium", conforme o prompt descreve ao usuário.
LOW_MAX = 3000.0
MEDIUM_MAX = 6000.0

# Teto de cada nível, para o caminho inverso (nível -> preço máximo aceitável).
BUDGET_CEILINGS: dict[BudgetLevel, float] = {
    "low": LOW_MAX,
    "medium": MEDIUM_MAX,
    "high": float("inf"),
}


def level_for_amount(amount: float) -> BudgetLevel:
    """Abaixo de 3000 é low; 3000 a 6000 inclusive é medium; acima é high."""
    if amount < LOW_MAX:
        return "low"
    if amount <= MEDIUM_MAX:
        return "medium"
    return "high"


def resolve_budget(preferences: TravelPreferences) -> TravelPreferences:
    """Um valor declarado define o nível — o modelo não opina.

    Quem disse "5000 reais" disse o suficiente; `budget_level` vira consequência
    aritmética. Sem valor declarado, o nível veio de palavras ("barato",
    "luxo") e é o modelo quem sabe — aí fica como está.
    """
    if preferences.max_budget is None:
        return preferences

    return preferences.model_copy(
        update={"budget_level": level_for_amount(preferences.max_budget)}
    )
