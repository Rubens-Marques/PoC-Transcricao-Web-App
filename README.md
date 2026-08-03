# Recomendação de Viagens por Voz com IA — PoC (Versão 1)

> Read this in [English](README.en.md).

Fale sobre a viagem que você quer; receba de volta os pacotes que combinam.

Isto é uma prova de conceito, não uma aplicação de produção. Existe para mostrar
que uma cadeia funciona de ponta a ponta:

```
Voz → Texto → LLM → Dados Estruturados → Busca no Banco → Recomendação
```

- **Voz para texto** acontece no browser, via Web Speech API. Nenhum áudio chega
  a este backend. (Vale notar que a implementação do Chrome ainda envia o áudio
  para os servidores de reconhecimento do próprio Google — ver
  [DOCUMENTACAO.pt-BR.md](DOCUMENTACAO.pt-BR.md) §6.1.)
- **O LLM** é usado estritamente como parser: entra uma frase, sai um objeto
  JSON. Ele nunca conversa.
- **A busca** é pontuação determinística por pesos sobre uma tabela SQLite. Sem
  aprendizado, sem embeddings.

> **[DOCUMENTACAO.pt-BR.md](DOCUMENTACAO.pt-BR.md)** (também em inglês:
> **[DOCUMENTATION.md](DOCUMENTATION.md)**) — o registro completo de decisões de
> cada camada (o que foi escolhido, por quê, e o que foi descartado), mais um
> estudo de projeto para uma versão 2 que substitui os dois modelos de IA por
> modelos locais: Whisper para transcrição e um LLM instruct pequeno para
> extração.

---

## Arquitetura

```
┌──────────────────────── Browser ─────────────────────────┐
│  Microfone                                               │
│      │                                                   │
│      ▼                                                   │
│  Web Speech API  ──►  texto transcrito                   │
│                            │                             │
│  Next.js + React + TypeScript + Tailwind                 │
└────────────────────────────┼─────────────────────────────┘
                             │  POST /api/recommendations
                             ▼
┌──────────────────────── FastAPI ─────────────────────────┐
│  routes/recommendations.py                               │
│      │                                                   │
│      ├─► services/llm_service.py ──► Anthropic Messages  │
│      │      (structured output)      API (externa)       │
│      │            │                                      │
│      │            ▼  TravelPreferences (JSON)            │
│      │                                                   │
│      └─► services/search_service.py ──► SQLite           │
│                     │                   travel_packages  │
│                     ▼                                    │
│           recomendações ranqueadas                       │
└──────────────────────────────────────────────────────────┘
```

### Stack

| Camada   | Escolha                                                          |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4   |
| Backend  | FastAPI, Pydantic v2                                             |
| Banco    | SQLite                                                           |
| IA       | Apenas API externa (Anthropic Messages API). Sem modelos locais. |

---

## Estrutura do projeto

```
POC/
├── backend/
│   ├── main.py                     # create_app(), CORS, lifespan
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   └── recommendations.py      # POST /api/recommendations
│   ├── services/
│   │   ├── llm_service.py          # extract_travel_preferences(text)
│   │   └── search_service.py       # pontuação determinística
│   ├── models/
│   │   └── travel.py               # contratos Pydantic
│   ├── database/
│   │   ├── db.py                   # conexão + schema
│   │   └── seed.py                 # 12 pacotes de demonstração
│   └── tests/                      # pytest
└── frontend/
    ├── app/                        # layout.tsx, page.tsx, globals.css
    ├── components/                 # VoiceRecorder, ResultsList, PackageCard, …
    ├── hooks/                      # useSpeechRecognition
    ├── services/                   # api.ts
    └── types/                      # travel.ts (espelha os modelos Pydantic)
```

---

## Setup

Pré-requisitos: **Python 3.11+** e **Node.js 20+**.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # depois edite — ver "Variáveis de ambiente" abaixo
python -m database.seed   # cria data/travel.db com 12 pacotes

uvicorn main:app --reload
```

A API escuta em <http://localhost:8000>. Documentação interativa em
<http://localhost:8000/docs>.

### 2. Frontend

Em um segundo terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Abra <http://localhost:3000>.

---

## Variáveis de ambiente

Nenhum secret fica no código. Os dois arquivos `.env` estão no gitignore; apenas
os templates `.example` são commitados.

### `backend/.env`

| Variável        | Obrigatória | Padrão                   | Observações                                      |
| --------------- | ----------- | ------------------------ | ------------------------------------------------ |
| `LLM_PROVIDER`  | não         | `anthropic`              | `anthropic` ou `mock`                            |
| `LLM_API_KEY`   | sim¹        | —                        | Chave de API do provider                         |
| `LLM_MODEL`     | não         | `claude-opus-5`          | Qualquer modelo com suporte a structured outputs |
| `CORS_ORIGINS`  | não         | `http://localhost:3000`  | Separadas por vírgula                            |
| `DATABASE_PATH` | não         | `backend/data/travel.db` |                                                  |
| `LOG_LEVEL`     | não         | `INFO`                   |                                                  |

¹ Obrigatória apenas quando `LLM_PROVIDER=anthropic`.

**`LLM_PROVIDER=mock`** troca a chamada de API por casamento de palavras-chave
local (PT e EN). Existe para que a cadeia inteira possa ser demonstrada — e
testada em CI — sem uma chave. É apoio de demonstração, não fallback: entende um
punhado de palavras-chave, não linguagem.

### `frontend/.env.local`

| Variável                   | Padrão                  |
| -------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` |

---

## API

### `POST /api/recommendations`

**Requisição**

```json
{ "text": "Quero uma viagem de praia em dezembro" }
```

| Campo  | Tipo   | Restrições          |
| ------ | ------ | ------------------- |
| `text` | string | 1 a 1000 caracteres |

**Resposta `200`**

```json
{
  "preferences": {
    "destination": null,
    "category": "beach",
    "month": "December",
    "travelers": null,
    "budget_level": null,
    "max_budget": null
  },
  "recommendations": [
    {
      "id": 3,
      "name": "Natal Beach Holiday",
      "destination": "Natal",
      "country": "Brazil",
      "category": "beach",
      "description": "Dunes, buggy rides and calm beaches …",
      "days": 6,
      "price": 4200.0,
      "max_people": 4,
      "best_months": ["December", "January"],
      "score": 150,
      "match_reasons": ["Category matches beach", "Good season in December"]
    }
  ]
}
```

Os valores dentro do JSON são tokens canônicos em inglês, independentemente do
idioma falado — é o schema que define isso, e a UI traduz na exibição.

`score` e `match_reasons` são acréscimos ao formato mínimo do spec. Eles tornam o
ranking auditável, que é boa parte do propósito de uma demonstração de PoC.

**Erros**

| Status | Quando                                                                 |
| ------ | ---------------------------------------------------------------------- |
| `422`  | `text` ausente, vazio ou acima de 1000 caracteres                      |
| `502`  | O LLM respondeu mas a resposta era inutilizável (ou ele recusou)       |
| `503`  | O provider de LLM está mal configurado — ex.: `LLM_API_KEY` não setada |

### `GET /health`

```json
{ "status": "ok", "provider": "anthropic" }
```

---

## Como funciona a extração

`extract_travel_preferences(text)` envia a frase para a Messages API com um JSON
Schema anexado via `output_config.format`. A conformidade com o schema é garantida
server-side, então a resposta é sempre JSON válido no formato esperado — não há
prompt de reparo nem adivinhação com `try: json.loads()`.

O modelo é instruído a aceitar entrada em português ou inglês e sempre emitir os
tokens canônicos em inglês que o schema define.

```json
{
  "destination": null,
  "category": "beach",
  "month": "January",
  "travelers": 2,
  "budget_level": "low",
  "max_budget": null
}
```

Todo campo é nullable. Um campo só é preenchido quando o falante realmente disse
aquilo — o modelo é instruído a não adivinhar.

---

## Como funciona a busca

Cada pacote é pontuado contra as preferências extraídas, do maior para o menor,
com empates desfeitos pelo menor preço. Os pesos codificam a ordem de prioridade
do spec:

| Sinal                                  | Peso |
| -------------------------------------- | ---: |
| Destino nomeado pelo usuário           |  200 |
| Categoria casa                         |  100 |
| Mês está na melhor temporada do pacote |   50 |
| Preço cabe no orçamento                |   25 |
| Grupo cabe na capacidade do pacote     |   10 |

O destino fica deliberadamente acima da soma de todo o resto: se alguém nomeia um
lugar, isso vence um pacote que casa com todos os critérios moles em outro lugar.

Tetos de orçamento quando nenhum valor explícito é dado: `low` ≤ R$ 3.000,
`medium` ≤ R$ 6.000, `high` sem limite. Um `max_budget` explícito sempre vence o
nível.

Pacotes com pontuação 0 são descartados quando ao menos uma preferência foi
extraída. Quando nada foi entendido, os pacotes mais baratos são devolvidos em vez
de uma lista vazia.

---

## Testes

```bash
cd backend
source .venv/bin/activate
pytest
```

23 testes cobrindo as regras de pontuação, o contrato de extração e o endpoint
HTTP. A suíte roda offline: `tests/conftest.py` força `LLM_PROVIDER=mock` e aponta
o banco para um diretório temporário, então nenhuma chave de API é necessária e o
`data/travel.db` populado nunca é tocado.

Verificação de tipos do frontend:

```bash
cd frontend
npm run typecheck
```

---

## Suporte dos browsers

O suporte à Web Speech API não é uniforme.

| Browser      | Entrada por voz                    |
| ------------ | ---------------------------------- |
| Chrome, Edge | Funciona                           |
| Safari       | Parcial, atrás do prefixo `webkit` |
| Firefox      | Sem suporte                        |

A UI detecta o suporte e avisa. A caixa de transcrição é sempre editável, então o
resto da cadeia pode ser demonstrado digitando quando o microfone não está
disponível.

O reconhecimento de fala também exige contexto seguro: `localhost` ou HTTPS.

---

## Limitações conhecidas

Deliberadas, para uma versão 1:

- Sem autenticação, sem pagamentos, sem reserva.
- O catálogo são 12 linhas fixas carregadas por um script de seed.
- As queries SQLite rodam de forma síncrona dentro de rotas async. O conjunto de
  dados são uma dúzia de linhas locais, então a janela de bloqueio é desprezível;
  o caminho de evolução está marcado com um comentário `ponytail:` em
  `backend/database/db.py`.
- O `npm audit` reporta 3 vulnerabilidades de severidade alta em `postcss` e
  `sharp`, ambas dependências transitivas embutidas no Next.js 16.2.12. O
  `npm audit fix --force` "resolve" rebaixando para o Next.js 9 — não rode. São
  problemas de toolchain de build, sem exposição em runtime para uma PoC local;
  somem quando o Next publicar um bundle atualizado.

Explicitamente fora de escopo, conforme o spec: modelos de IA locais (Whisper,
Ollama, Qwen, Llama), apps mobile e Electron. Uma versão futura pode substituir a
Speech API do browser por Whisper local + WebGPU — esta versão fica simples de
propósito.
