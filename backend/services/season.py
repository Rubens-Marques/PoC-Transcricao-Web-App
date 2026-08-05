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

# Os três meses de cada estação, por hemisfério. O primeiro da tupla é o mês
# central, usado quando é preciso escolher um.
_SOUTHERN: dict[Season, tuple[Month, ...]] = {
    "summer": ("January", "December", "February"),
    "autumn": ("April", "March", "May"),
    "winter": ("July", "June", "August"),
    "spring": ("October", "September", "November"),
}

_NORTHERN: dict[Season, tuple[Month, ...]] = {
    "summer": ("July", "June", "August"),
    "autumn": ("October", "September", "November"),
    "winter": ("January", "December", "February"),
    "spring": ("April", "March", "May"),
}


def is_southern(country: str | None) -> bool:
    """Sul é o default: sem país, ou com país desconhecido, assume sul."""
    if country is None:
        return True
    return country.strip().casefold() not in NORTHERN_COUNTRIES


def months_in_season(season: Season, country: str | None) -> tuple[Month, ...]:
    table = _SOUTHERN if is_southern(country) else _NORTHERN
    return table[season]


def month_for_season(season: Season, country: str | None) -> Month:
    """Mês central da estação no hemisfério do país."""
    return months_in_season(season, country)[0]


def resolve_season(preferences: TravelPreferences) -> TravelPreferences:
    """Reconcilia `month` e `season`.

    O prompt manda o modelo deixar `month` nulo quando o falante deu só a
    estação, mas o `qwen2.5:3b` desobedece: para "verão no Brasil" ele devolvia
    season "summer" E month "June" — a conversão fixa dele, errada para o sul.

    Confiar cegamente no mês perpetuaria esse erro; ignorá-lo quebraria
    "julho, no verão", onde o falante realmente disse o mês. A saída é checar
    consistência: um mês que pertence à estação naquele hemisfério é preservado,
    e um que não pertence é substituído pelo mês central da estação.
    """
    if preferences.season is None:
        return preferences

    valid = months_in_season(preferences.season, preferences.country)
    if preferences.month in valid:
        return preferences

    return preferences.model_copy(update={"month": valid[0]})
