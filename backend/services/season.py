"""Estação + país -> mês.

Isto existe como código, e não como regra de prompt, por medição: pedido para
aplicar "hemisfério norte ou sul conforme o país", o `qwen2.5:3b` respondia
"verão" -> June e "inverno" -> July independentemente do país mencionado. Ele
extrai `country` e `season` de forma confiável; é a inferência condicional
entre os dois que ele não faz.

A regra é determinística e barata. Deixá-la no modelo trocava uma tabela de
oito linhas por uma fonte de erro silencioso.
"""

from __future__ import annotations

from models.travel import Month, Season, TravelPreferences

# Lista o hemisfério NORTE, não o sul: o default é sul, porque o falante é
# brasileiro e é o palpite certo quando nada foi dito ou quando o país não é
# reconhecido. Um país desconhecido não casa com nenhum pacote de qualquer
# forma, então o mês derivado dele tem pouco efeito prático.
NORTHERN_COUNTRIES: frozenset[str] = frozenset(
    {
        "italy",
        "france",
        "spain",
        "portugal",
        "japan",
        "united states",
        "usa",
        "canada",
        "united kingdom",
        "germany",
        "greece",
        "netherlands",
        "mexico",
        "morocco",
        "egypt",
        "thailand",
    }
)

# Mês central de cada estação, por hemisfério.
_SOUTHERN: dict[Season, Month] = {
    "summer": "January",
    "autumn": "April",
    "winter": "July",
    "spring": "October",
}

_NORTHERN: dict[Season, Month] = {
    "summer": "July",
    "autumn": "October",
    "winter": "January",
    "spring": "April",
}


def is_southern(country: str | None) -> bool:
    """Sul é o default: sem país, ou com país desconhecido, assume sul."""
    if country is None:
        return True
    return country.strip().casefold() not in NORTHERN_COUNTRIES


def month_for_season(season: Season, country: str | None) -> Month:
    table = _SOUTHERN if is_southern(country) else _NORTHERN
    return table[season]


def resolve_season(preferences: TravelPreferences) -> TravelPreferences:
    """Preenche `month` a partir de `season` quando o falante deu só a estação.

    Um mês explícito sempre vence: quem disse "julho" disse julho, mesmo que
    também tenha dito "inverno".
    """
    if preferences.month is not None or preferences.season is None:
        return preferences

    return preferences.model_copy(
        update={"month": month_for_season(preferences.season, preferences.country)}
    )
