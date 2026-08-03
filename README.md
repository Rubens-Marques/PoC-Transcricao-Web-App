# AI Voice Travel Recommendation — PoC (Version 1)

Speak about the trip you want; get matching travel packages back.

This is a proof of concept, not a production application. It exists to show that
one chain works end to end:

```
Voice → Text → LLM → Structured Data → Database Search → Recommendation
```

- **Speech to text** happens in the browser via the Web Speech API. No audio
  reaches this backend. (Note that Chrome's implementation still sends the audio
  to Google's own recognition servers — see [DOCUMENTATION.md](DOCUMENTATION.md)
  §6.1.)
- **The LLM** is used strictly as a parser: one sentence in, one JSON object out.
  It never holds a conversation.
- **The search** is deterministic weighted scoring over a SQLite table. No
  learning, no embeddings.

> **[DOCUMENTATION.md](DOCUMENTATION.md)** (also in Portuguese:
> **[DOCUMENTACAO.pt-BR.md](DOCUMENTACAO.pt-BR.md)**) — the full decision record
> for every layer (what was chosen, why, and what was rejected), plus a design
> study for a version 2 that replaces both AI models with local ones: Whisper for
> transcription and a small instruct LLM for extraction.

---

## Architecture

```
┌──────────────────────── Browser ─────────────────────────┐
│  Microphone                                              │
│      │                                                   │
│      ▼                                                   │
│  Web Speech API  ──►  transcript text                    │
│                            │                             │
│  Next.js + React + TypeScript + Tailwind                 │
└────────────────────────────┼─────────────────────────────┘
                             │  POST /api/recommendations
                             ▼
┌──────────────────────── FastAPI ─────────────────────────┐
│  routes/recommendations.py                               │
│      │                                                   │
│      ├─► services/llm_service.py ──► Anthropic Messages  │
│      │      (structured output)      API (external)      │
│      │            │                                      │
│      │            ▼  TravelPreferences (JSON)            │
│      │                                                   │
│      └─► services/search_service.py ──► SQLite           │
│                     │                   travel_packages  │
│                     ▼                                    │
│            ranked recommendations                        │
└──────────────────────────────────────────────────────────┘
```

### Stack

| Layer    | Choice                                                         |
| -------- | -------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend  | FastAPI, Pydantic v2                                           |
| Database | SQLite                                                         |
| AI       | External API only (Anthropic Messages API). No local models.   |

---

## Project structure

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
│   │   └── search_service.py       # deterministic scoring
│   ├── models/
│   │   └── travel.py               # Pydantic contracts
│   ├── database/
│   │   ├── db.py                   # connection + schema
│   │   └── seed.py                 # 12 demo packages
│   └── tests/                      # pytest
└── frontend/
    ├── app/                        # layout.tsx, page.tsx, globals.css
    ├── components/                 # VoiceRecorder, ResultsList, PackageCard, …
    ├── hooks/                      # useSpeechRecognition
    ├── services/                   # api.ts
    └── types/                      # travel.ts (mirrors the Pydantic models)
```

---

## Setup

Prerequisites: **Python 3.11+** and **Node.js 20+**.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # then edit it — see "Environment" below
python -m database.seed   # creates data/travel.db with 12 packages

uvicorn main:app --reload
```

The API listens on <http://localhost:8000>. Interactive docs at
<http://localhost:8000/docs>.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>.

---

## Environment

Secrets are never hardcoded. Both `.env` files are gitignored; only the
`.example` templates are committed.

### `backend/.env`

| Variable        | Required | Default                  | Notes                                      |
| --------------- | -------- | ------------------------ | ------------------------------------------ |
| `LLM_PROVIDER`  | no       | `anthropic`              | `anthropic` or `mock`                      |
| `LLM_API_KEY`   | yes¹     | —                        | Provider API key                           |
| `LLM_MODEL`     | no       | `claude-opus-5`          | Any model that supports structured outputs |
| `CORS_ORIGINS`  | no       | `http://localhost:3000`  | Comma-separated                            |
| `DATABASE_PATH` | no       | `backend/data/travel.db` |                                            |
| `LOG_LEVEL`     | no       | `INFO`                   |                                            |

¹ Required only when `LLM_PROVIDER=anthropic`.

**`LLM_PROVIDER=mock`** swaps the API call for local keyword matching (PT and
EN). It exists so the whole chain can be demoed — and tested in CI — without a
key. It is a demo aid, not a fallback: it understands a handful of keywords, not
language.

### `frontend/.env.local`

| Variable                   | Default                 |
| -------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` |

---

## API

### `POST /api/recommendations`

**Request**

```json
{ "text": "I want a beach trip in December" }
```

| Field  | Type   | Constraints       |
| ------ | ------ | ----------------- |
| `text` | string | 1–1000 characters |

**Response `200`**

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

`score` and `match_reasons` are additions to the minimal spec response. They make
the ranking auditable, which is most of the point of a PoC demo.

**Errors**

| Status | When                                                              |
| ------ | ----------------------------------------------------------------- |
| `422`  | `text` missing, empty, or over 1000 characters                    |
| `502`  | The LLM answered but the answer was unusable (or it refused)      |
| `503`  | The LLM provider is misconfigured — e.g. `LLM_API_KEY` is not set |

### `GET /health`

```json
{ "status": "ok", "provider": "anthropic" }
```

---

## How extraction works

`extract_travel_preferences(text)` sends the sentence to the Messages API with a
JSON Schema attached via `output_config.format`. Schema conformance is enforced
server-side, so the response is always valid JSON in the expected shape — there
is no repair prompting and no `try: json.loads()` guesswork.

The model is told to accept Portuguese or English input and always emit the
canonical English tokens the schema defines.

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

Every field is nullable. A field is filled only when the speaker actually said
it — the model is instructed not to guess.

---

## How search works

Each package is scored against the extracted preferences, highest first, ties
broken by the lower price. Weights encode the priority order from the spec:

| Signal                                | Weight |
| ------------------------------------- | -----: |
| Destination named by the user         |    200 |
| Category matches                      |    100 |
| Month is in the package's best season |     50 |
| Price fits the budget                 |     25 |
| Group fits the package capacity       |     10 |

Destination sits deliberately above the sum of everything else: if someone names
a place, that beats a package matching all the soft criteria somewhere else.

Budget ceilings when no explicit amount is given: `low` ≤ R$ 3.000,
`medium` ≤ R$ 6.000, `high` unbounded. An explicit `max_budget` always wins over
the level.

Packages scoring 0 are dropped when at least one preference was extracted. When
nothing at all was understood, the cheapest packages are returned instead of an
empty list.

---

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

23 tests covering the scoring rules, the extraction contract, and the HTTP
endpoint. The suite runs offline: `tests/conftest.py` forces `LLM_PROVIDER=mock`
and points the database at a temp directory, so no API key is needed and the
seeded `data/travel.db` is never touched.

Frontend type checking:

```bash
cd frontend
npm run typecheck
```

---

## Browser support

The Web Speech API is not evenly supported.

| Browser      | Speech input                    |
| ------------ | ------------------------------- |
| Chrome, Edge | Works                           |
| Safari       | Partial, behind `webkit` prefix |
| Firefox      | Not supported                   |

The UI detects support and says so. The transcription box is always editable, so
the rest of the chain can be demonstrated by typing when the microphone is
unavailable.

Speech recognition also requires a secure context: `localhost` or HTTPS.

---

## Known limitations

Deliberate, for a version 1:

- No authentication, no payments, no booking.
- The catalogue is 12 fixed rows loaded by a seed script.
- SQLite queries run synchronously inside async routes. The dataset is a dozen
  local rows, so the blocking window is negligible; the upgrade path is marked
  with a `ponytail:` comment in `backend/database/db.py`.
- `npm audit` reports 3 high-severity advisories in `postcss` and `sharp`, both
  transitive dependencies bundled inside Next.js 16.2.12. `npm audit fix --force`
  "resolves" them by downgrading to Next.js 9 — do not run it. They are
  build-toolchain issues with no runtime exposure for a local PoC; they clear
  when Next ships an updated bundle.

Explicitly out of scope, per the spec: local AI models (Whisper, Ollama, Qwen,
Llama), mobile apps, and Electron. A future version may replace the browser
Speech API with local Whisper + WebGPU — this version stays simple on purpose.
