"""Mede a qualidade da interpretação do cadastro contra casos rotulados à mão.

Irmão de run_eval.py, e pelo mesmo motivo: a suíte do pytest roda no provider
`mock` e verifica o *contrato*; só um modelo de verdade diz se "solteirão" vira
solteiro. Não passa nem falha — mede.

    cd backend
    LLM_PROVIDER=ollama LLM_MODEL=qwen2.5:3b python -m eval.run_signup_eval

Contra o Ollama da VPS, sem instalar modelo local:

    ssh -N -L 11434:localhost:11434 elabore-vps   # noutro terminal
    LLM_PROVIDER=ollama OLLAMA_HOST=http://localhost:11434 \
        python -m eval.run_signup_eval
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

from services.signup_service import interpret_signup_answer

CASES_PATH = Path(__file__).parent / "signup_cases.json"


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
    host = os.environ.get("OLLAMA_HOST", "(default)")
    print(f"provider={provider}  model={model}  host={host}  casos={len(cases)}\n")

    checks = correct = 0
    per_tag: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # [ok, total]
    latencies: list[float] = []
    failed_lines: list[str] = []
    failures = 0

    for case in cases:
        field = case["field"]
        text = case["text"]
        tag = case["tag"]
        expected = dict(case.get("expected", {}))
        strict_null = case.get("strict_null", [])
        # `hobbies_min` não é um campo: é "veio pelo menos N itens".
        hobbies_min = expected.pop("hobbies_min", None)

        started = time.perf_counter()
        try:
            answer = (await interpret_signup_answer(field, text)).model_dump()
        except Exception as exc:  # noqa: BLE001 — o relatório precisa continuar
            print(f"  ERRO  {text[:50]!r}: {type(exc).__name__}: {exc}")
            return 1
        latencies.append(time.perf_counter() - started)

        wrong: list[str] = []

        for name, want in expected.items():
            checks += 1
            per_tag[tag][1] += 1
            if _matches(answer.get(name), want):
                per_tag[tag][0] += 1
                correct += 1
            else:
                wrong.append(f"{name}={answer.get(name)!r} (esperado {want!r})")

        if hobbies_min is not None:
            checks += 1
            per_tag[tag][1] += 1
            got = len(answer.get("hobbies") or [])
            if got >= hobbies_min:
                per_tag[tag][0] += 1
                correct += 1
            else:
                wrong.append(f"hobbies={got} itens (esperado >= {hobbies_min})")

        for name in strict_null:
            checks += 1
            per_tag[tag][1] += 1
            if answer.get(name) is None:
                per_tag[tag][0] += 1
                correct += 1
            else:
                wrong.append(f"{name}={answer.get(name)!r} (esperado null)")

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

    latencies.sort()
    print(
        f"\nCAMPOS      {correct}/{checks} = {100 * correct / checks:.1f}%"
        f"\nRESPOSTAS   {len(cases) - failures}/{len(cases)} sem nenhum erro"
        f"\nLATÊNCIA    mediana {statistics.median(latencies):.2f}s"
        f" | p90 {latencies[int(0.9 * len(latencies)) - 1]:.2f}s"
        f" | total {sum(latencies):.0f}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
