"""Mede a qualidade da extração contra um conjunto rotulado à mão.

Isto não é um teste: não passa nem falha, mede. A suíte do pytest verifica o
contrato (sai um TravelPreferences válido); este script verifica se o conteúdo
está certo, que é coisa que só se sabe rodando um modelo de verdade.

    cd backend
    LLM_PROVIDER=ollama LLM_MODEL=qwen2.5:3b python -m eval.run_eval

Contra a VPS, sem instalar modelo local:

    ssh -L 11434:localhost:11434 elabore-vps    # noutro terminal
    LLM_PROVIDER=ollama OLLAMA_HOST=http://localhost:11434 python -m eval.run_eval
"""

from __future__ import annotations

import asyncio
import json
import os
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from services.llm_service import extract_travel_preferences

CASES_PATH = Path(__file__).parent / "cases.json"


def _matches(got: Any, expected: Any) -> bool:
    """Uma lista em `expected` significa 'qualquer um destes serve'."""
    if isinstance(expected, list):
        return got in expected
    return got == expected


async def main() -> int:
    payload = json.loads(CASES_PATH.read_text())
    cases = payload["cases"]

    provider = os.environ.get("LLM_PROVIDER", "ollama")
    model = os.environ.get("LLM_MODEL", "(default)")
    print(f"provider={provider}  model={model}  casos={len(cases)}\n")

    checks = failures = 0
    per_tag: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # [ok, total]
    latencies: list[float] = []
    failed_lines: list[str] = []

    for case in cases:
        text = case["text"]
        tag = case["tag"]
        expected = case.get("expected", {})
        strict_null = case.get("strict_null", [])

        started = time.perf_counter()
        try:
            prefs = (await extract_travel_preferences(text)).model_dump()
        except Exception as exc:  # noqa: BLE001 — o relatório precisa continuar
            print(f"  ERRO  {text[:50]!r}: {type(exc).__name__}: {exc}")
            return 1
        latencies.append(time.perf_counter() - started)

        wrong: list[str] = []
        for field, want in expected.items():
            checks += 1
            per_tag[tag][1] += 1
            if _matches(prefs.get(field), want):
                per_tag[tag][0] += 1
            else:
                wrong.append(f"{field}={prefs.get(field)!r} (esperado {want!r})")

        for field in strict_null:
            checks += 1
            per_tag[tag][1] += 1
            if prefs.get(field) is None:
                per_tag[tag][0] += 1
            else:
                wrong.append(f"{field}={prefs.get(field)!r} (esperado null)")

        if wrong:
            failures += 1
            failed_lines.append(f"  [{tag}] {text!r}")
            failed_lines.extend(f"        {w}" for w in wrong)

    if failed_lines:
        print("FALHAS\n" + "\n".join(failed_lines) + "\n")

    print("POR CLASSE")
    for tag in sorted(per_tag, key=lambda t: per_tag[t][0] / per_tag[t][1]):
        ok, total = per_tag[tag]
        bar = "#" * round(20 * ok / total)
        print(f"  {tag:<20} {ok:>3}/{total:<3} {100 * ok / total:5.1f}%  {bar}")

    correct = checks - sum(1 for line in failed_lines if line.startswith("        "))
    latencies.sort()
    print(
        f"\nCAMPOS      {correct}/{checks} = {100 * correct / checks:.1f}%"
        f"\nFRASES      {len(cases) - failures}/{len(cases)} sem nenhum erro"
        f"\nLATÊNCIA    mediana {statistics.median(latencies):.2f}s"
        f" | p90 {latencies[int(0.9 * len(latencies)) - 1]:.2f}s"
        f" | total {sum(latencies):.0f}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
