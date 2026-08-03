# Technical Documentation

> Também disponível em português: [DOCUMENTACAO.pt-BR.md](DOCUMENTACAO.pt-BR.md).

Two parts:

- **Part I** records what was built in version 1, how each piece works, and why
  each choice was made over the alternatives that were rejected.
- **Part II** answers a forward-looking question: what changes if the two AI
  models move from an external API to local models — Whisper for transcription
  and a small local LLM for data extraction.

Part II is **design, not implementation**. The version 1 spec explicitly forbids
local models; nothing in Part II is present in the codebase.

---

# Part I — What was built

## 1. The chain

The PoC exists to prove one sequence works end to end:

```
Voice → Text → LLM → Structured Data → Database Search → Recommendation
```

Each arrow is a boundary where something could fail, and each was built so the
failure is visible rather than silent.

| Step                     | Where it runs | Component                                  |
| ------------------------ | ------------- | ------------------------------------------ |
| Voice → Text             | Browser       | Web Speech API, via `useSpeechRecognition` |
| Text → Structured Data   | External API  | `llm_service.extract_travel_preferences`   |
| Structured Data → Search | Backend       | `search_service.search_packages`           |
| Search → Recommendation  | Browser       | `ResultsList` / `PackageCard`              |

The central design idea is that **the LLM is a parser, not a conversationalist**.
It receives one sentence and returns one JSON object. It has no memory, no tools,
no dialogue, and no say in ranking. That keeps the AI surface small enough to
reason about, and it means a bad model answer produces a bad _filter_, never a
bad _recommendation engine_.

---

## 2. Layer-by-layer decision record

### 2.1 Speech to text — Web Speech API

**What.** `useSpeechRecognition` wraps `window.SpeechRecognition` /
`window.webkitSpeechRecognition` with `continuous: true` and
`interimResults: true`.

**Why.** The spec mandates it, and for a version 1 it is the right call anyway:
zero infrastructure, zero model download, no audio upload endpoint to build or
secure, and it works the moment the page loads.

**How the transcript is accumulated.** The API emits both interim guesses and
finalized segments, and it revises interim guesses as you keep speaking. Naively
appending every result duplicates text. So finalized segments accumulate in a
ref, and interim text is appended for display only:

```ts
if (result.isFinal) {
  finalTranscriptRef.current =
    `${finalTranscriptRef.current} ${alternative.transcript}`.trim();
} else {
  interim += alternative.transcript;
}
setTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
```

**Why the types are local.** The Web Speech API is a draft spec. `lib.dom.d.ts`
has been adding these interfaces incrementally, so declaring them globally risks
a duplicate-identifier build break on a future TypeScript release. Instead the
hook defines structural `…Like` interfaces locally and narrows `window` through a
single cast. It cannot collide with anything.

**Why the transcription box is editable.** Firefox does not implement the Web
Speech API and Safari's support is partial. If the transcript were read-only,
the demo would be undemonstrable in two of three major browsers. A `textarea`
costs nothing and makes the remaining four steps of the chain provable by typing.

**What was accepted as a cost.** No control over the recognition model, no
offline operation, no timestamps, and — importantly — Chrome's implementation
sends the captured audio to Google's servers for recognition. "In the browser"
means _no audio touches our backend_; it does not mean the audio stays on the
device. Part II addresses exactly this.

---

### 2.2 LLM layer — external API used as a parser

**What.** `extract_travel_preferences(text)` sends one sentence to the Anthropic
Messages API and returns a validated `TravelPreferences` object.

**Why structured outputs rather than prompt-and-parse.** The request attaches a
JSON Schema via `output_config.format`:

```python
response = await client.messages.create(
    model=model,
    max_tokens=1024,
    system=SYSTEM_PROMPT,
    output_config={
        "effort": "low",
        "format": {"type": "json_schema", "schema": PREFERENCES_SCHEMA},
    },
    messages=[{"role": "user", "content": text}],
)
```

Schema conformance is enforced server-side during generation. The practical
consequence is that a whole category of code does not exist in this repository:
no retry-on-invalid-JSON, no "repair prompt", no regex to strip a ```json fence,
no defensive `try: json.loads()`. The response is either valid or the request
failed loudly.

This is also the single most important decision for Part II, because it defines
a contract that survives a change of model — see §7.2.

**Why every field is nullable.** A spoken sentence rarely mentions all six
fields. The alternative — required fields with sentinel defaults — forces the
model to invent values, and an invented `month` silently corrupts the search. The
system prompt reinforces it: _"Only fill a field the speaker actually expressed.
Never guess."_

**Why the schema is hand-written instead of generated from Pydantic.**
Structured outputs require `additionalProperties: false` and every property
listed in `required`; Pydantic emits neither by default for optional fields.
Rather than post-process generated output, the schema is explicit. Drift is
prevented two ways: the enum values are derived from the same `Literal` types via
`typing.get_args`, and a test asserts the schema's field set equals
`TravelPreferences.model_fields`.

**Why `effort: "low"`.** Extraction is shallow work — no multi-step reasoning,
no tool use. Low effort keeps the voice loop responsive. Thinking is left on
(the default) rather than disabled, because disabling it on this model class has
documented failure modes and the latency saving does not justify them.

**Why the system prompt says what it says.** Each rule exists because of a
specific failure it prevents:

| Prompt rule                                                 | Failure it prevents                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| "canonical English tokens regardless of input language"     | PT input yielding `"praia"`, which matches no category       |
| "`travelers` counts every person… 'with my wife' is 2"      | Off-by-one against `max_people`                              |
| "a stated number also implies a `budget_level`"             | `max_budget` set, `budget_level` null — inconsistent filters |
| "`destination` is the place name only, without the country" | `"Gramado, Brazil"` failing a substring match                |
| "Never guess. Use null otherwise."                          | Hallucinated months narrowing results wrongly                |

**Refusals are handled.** `stop_reason == "refusal"` is checked before reading
`response.content`, because on a refusal the content array can be empty — code
that indexes `content[0]` unconditionally would raise an unrelated error.

---

### 2.3 The contract — one schema, two consumers

`backend/models/travel.py` defines `TravelPreferences` once. It is simultaneously
the LLM's output type, the search function's input type, and part of the HTTP
response body. `frontend/types/travel.ts` mirrors it.

This matters more than it looks. The LLM boundary is the only place in the system
where an untyped external answer enters, and it is converted to a typed object at
exactly that boundary — `TravelPreferences.model_validate_json(payload)`. Nothing
downstream handles raw model output. If the shape ever changes, the failure is a
validation error at the seam, not a `KeyError` three layers deeper.

---

### 2.4 Provider abstraction and the mock

`LLM_PROVIDER` selects between `anthropic` and `mock`. The mock is local keyword
matching over PT and EN terms, with accent stripping and a regex for amounts.

**Why it exists.** Two concrete reasons, neither of them "fallback":

1. The test suite runs offline and with no API key. CI never needs a secret, and
   the tests never bill anything.
2. The chain can be demonstrated with the API layer removed, which isolates
   whether a problem is in the extraction or in the search.

**Why it is explicitly not a fallback.** It understands a fixed keyword list, not
language. Silently degrading to it in production would turn a loud failure into
a quietly wrong answer. So a misconfigured provider raises `LLMConfigurationError`
and the endpoint returns 503 — it never falls back.

---

### 2.5 Database — SQLite via stdlib `sqlite3`

**What.** One table, `travel_packages`, 12 rows loaded by `python -m database.seed`.

**Why no ORM.** The escalation ladder — does it need to exist, does it exist
already, is it in the standard library, is it a dependency we already have —
stops at the standard library. There is one table, one query, and no
relationships. SQLAlchemy would add a dependency, a session lifecycle, and a
migration story to a PoC that has none of those problems.

**Why `best_months` is a JSON string.** SQLite has no array type. The
alternatives are a join table (a second table and a join for a list of at most
twelve strings) or a delimited string (which invites substring bugs — `"May"`
matching inside `"May"`/`"March"` is fine, but the pattern is fragile). A JSON
column parsed with `json.loads` is honest about what it is and costs one line.

**The threading fix, and why it is not just a test artifact.** The first test run
failed with `SQLite objects created in a thread can only be used in that same
thread`. The cause is architectural, not test-specific: FastAPI resolves
synchronous dependencies in a worker thread, while the `async def` route body
runs on the event loop. The connection is genuinely created in one thread and
used in another. `check_same_thread=False` is correct here because
`get_connection` yields one connection per request and closes it in a `finally` —
there is no sharing between concurrent requests. Had this only been noticed in
production, it would have looked like a random 500.

**The documented ceiling.** Queries run synchronously inside async routes. For a
dozen local rows the blocking window is microseconds. The limit and its upgrade
path are marked with a `ponytail:` comment in `database/db.py` rather than
pre-solved.

---

### 2.6 Search — deterministic weighted scoring

**What.** Every package is scored against the preferences; the top 5 are returned.

| Signal                                | Weight |
| ------------------------------------- | -----: |
| Destination named by the user         |    200 |
| Category matches                      |    100 |
| Month is in the package's best season |     50 |
| Price fits the budget                 |     25 |
| Group fits the package capacity       |     10 |

**Why weights and not filters.** A chain of hard `WHERE` clauses returns nothing
the moment one criterion is unsatisfiable — ask for a beach in July under R$2.000
and you get an empty page. Scoring degrades gracefully: the best available match
surfaces, and `match_reasons` says exactly which criteria it met and which it
did not.

**Why 200 for destination.** The spec's priority list starts at category, but the
extraction schema has a `destination` field. Extracting it and then ignoring it
would be a hole in the pipeline. It is weighted above the _sum_ of all other
weights (185) deliberately: if someone names a place, that beats a package
matching every soft criterion somewhere else. A test asserts this invariant
directly, by scoring a named-place package that matches nothing else against a
rival that matches everything else.

**Why an explicit `max_budget` overrides `budget_level`.** "Luxury trip, but no
more than 4000" is a coherent sentence. The stated number is the harder
constraint and wins.

**Why zero-score packages are dropped — but only sometimes.** If at least one
preference was extracted, a package matching none of it is noise. If _nothing_
was extracted, dropping everything would return an empty page for a vague
request; the cheapest packages are returned instead.

**Why ties break on price.** Determinism. Two beach packages in December with
identical scores must order the same way on every run, or the demo looks random.

**Why `match_reasons` is in the response.** It makes the ranking auditable. In a
PoC, "why did it pick that?" is the first question anyone asks, and the answer
should be on screen rather than in the logs.

---

### 2.7 HTTP API — one endpoint, three failure modes

`POST /api/recommendations` is the whole pipeline. The error taxonomy
distinguishes causes that need different responses:

| Status | Meaning                                          | Who fixes it   |
| ------ | ------------------------------------------------ | -------------- |
| 422    | `text` missing, empty, or over 1000 chars        | The caller     |
| 502    | The provider answered, the answer was unusable   | Retry may help |
| 503    | The provider is misconfigured (no `LLM_API_KEY`) | The operator   |

A single 500 for all three would make a missing environment variable
indistinguishable from a model refusal.

The response is a superset of the spec's minimal shape — full package fields plus
`score` and `match_reasons` — because the UI renders cards, and a second
round-trip for details would be pointless at this size.

---

### 2.8 Frontend — App Router, one hook, one seam

**What.** Next.js 16 App Router, React 19, TypeScript in strict mode (plus
`noUncheckedIndexedAccess`), Tailwind CSS v4.

**Why App Router over `pages/`.** The spec's structure sketch said `/pages`, but
the App Router is the current Next.js default and the `pages` router is legacy.
The mapping is direct: `app/page.tsx` + `components/` + `services/`.

**Why one client component tree.** The page is a single interactive surface;
there is nothing to render on the server. `page.tsx` owns the result state,
`VoiceRecorder` owns the speech state. State lives at the lowest level that needs
it.

**Why `PreferencesSummary` exists.** It renders what the LLM understood. Without
it the extraction step is invisible — you speak, cards appear, and the AI layer
is an unexamined black box. Showing the six extracted fields is what makes this a
_demonstration_ of the chain rather than a search box.

**The seam that matters.** `useSpeechRecognition` returns a deliberately generic
interface:

```ts
interface UseSpeechRecognitionResult {
  isSupported: boolean | null;
  isListening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  setTranscript: (value: string) => void;
}
```

Nothing in that shape mentions the Web Speech API. It describes _transcription_,
not one implementation of it. Part II depends on this.

---

### 2.9 Configuration and secrets

No secrets in source. `.env` and `.env.local` are gitignored; only `.example`
templates are committed. CORS origins come from the environment rather than a
wildcard, and credentials are disabled on the CORS middleware since the API has
no cookies or auth.

---

### 2.10 Tests

23 tests, all offline. `tests/conftest.py` forces `LLM_PROVIDER=mock` and points
the database at a temp directory before any application module is imported, so
the suite needs no API key and never touches the seeded `data/travel.db`.

**What is tested and why.** Coverage was aimed at behaviour, not lines. The
scoring layer is the only place in this PoC with real branching logic, so it gets
the most tests — including the destination-outranks-everything invariant, the
`max_budget`-beats-`budget_level` rule, and the no-criteria fallback. The
extraction layer is tested for _contract_ (a valid `TravelPreferences` comes out;
the schema and the Pydantic model agree) rather than for model quality, which is
not something a unit test can assert. The API layer is tested end to end through
`TestClient`, which is what caught the SQLite threading bug.

---

## 3. Bugs found during verification

Both were found by running the code, not by reading it.

**1. SQLite connection crossing threads.** Described in §2.5. A real defect that
would have appeared in production as an intermittent 500.

**2. The destination weight contradicted its own comment.** The code documented
"an explicit destination outranks all of them" while weighting it 150 against a
possible 185 from the other signals combined. The test written to assert the
documented behaviour failed. The fix raised the weight to 200 rather than
weakening the test, because the documented intent was the correct one.

---

## 4. What was verified, and how

| Check                                    | Method                             | Result                          |
| ---------------------------------------- | ---------------------------------- | ------------------------------- |
| Scoring, extraction contract, HTTP layer | `pytest`                           | 23 passed                       |
| Type safety                              | `tsc --noEmit`                     | Clean                           |
| Production build                         | `next build`                       | Compiles, type-checks           |
| API behaviour                            | `curl` against a running server    | Correct preferences and ranking |
| Full UI flow                             | Browser, typed transcript → search | Cards render, no console errors |
| Responsive layout                        | Browser at 375×812                 | No overflow                     |
| Anthropic SDK call shape                 | Signature and schema introspection | Parameters valid                |

**Not verified: the live call to the Anthropic API.** No API key was available.
The request shape, parameter names, and schema were validated structurally, and
the response-handling path is exercised by the mock provider, but the network
round-trip itself is untested. This is the one gap in the verification above.

---

# Part II — Version 2 with local models

## 5. What "local" changes, and the two seams that make it cheap

Version 1 uses two external AI capabilities. Version 2 replaces both with models
that run on hardware you control:

|                             | Version 1                                | Version 2                   |
| --------------------------- | ---------------------------------------- | --------------------------- |
| **Model A** — transcription | Web Speech API (Chrome → Google servers) | Whisper, in the browser     |
| **Model B** — extraction    | Anthropic Messages API                   | Small instruct LLM, locally |

The migration is cheap because version 1 was built with exactly two seams, and
neither leaks its implementation:

1. **`useSpeechRecognition` returns transcription state, not Web Speech state.**
   A `useWhisperTranscription` hook with the same return shape is a drop-in
   replacement. `VoiceRecorder` does not change.
2. **`extract_travel_preferences(text) -> TravelPreferences` is provider-agnostic,
   and `LLM_PROVIDER` already branches.** Adding `ollama` is a new branch beside
   `anthropic` and `mock`. The route, the search layer, and the API contract do
   not change.

Everything between those two seams — the schema, the search, the UI, the tests —
is unaffected by the swap. That is the payoff of having defined an explicit
contract in §2.2 and §2.3.

---

## 6. Model A — local transcription with Whisper

### 6.1 Why replace the Web Speech API at all

Four reasons, in order of how much they actually matter here:

**Privacy is the real one.** Chrome's `SpeechRecognition` implementation sends
captured audio to Google's servers for recognition. Version 1's claim that "no
audio touches our backend" is true and beside the point — the audio still leaves
the device. Whisper in the browser is the only option in this document where the
audio genuinely never leaves the user's machine. For a travel product this is
mild; for anything touching health, finance, or legal it is decisive.

**Browser coverage.** Firefox does not implement the Web Speech API at all;
Safari's support is partial. Whisper compiled to WASM/WebGPU runs anywhere the
browser can run WebAssembly, which is everywhere. This turns "works in Chrome and
Edge" into "works".

**Reproducibility.** The Web Speech API is a black box that can change under you
with no version, no changelog, and no way to pin behaviour. `whisper-base` at a
given revision is a fixed artifact. If transcription quality regresses, you can
tell whether it was your change.

**PT-BR accuracy.** Whisper's multilingual training gives noticeably better
handling of Brazilian place names and accented speech than the generic browser
recognizer — relevant when the catalogue is full of words like _Maragogi_,
_Fernando de Noronha_, and _Chapada Diamantina_.

### 6.2 Which Whisper, and what the download costs

Whisper ships in sizes. The trade is download weight and RAM against accuracy:

| Model                    | Parameters | Practical browser fit                                            |
| ------------------------ | ---------: | ---------------------------------------------------------------- |
| `whisper-tiny`           |        39M | Fastest, weakest. Fine for English commands, weak on PT-BR names |
| `whisper-base`           |        74M | The realistic default for this use case                          |
| `whisper-small`          |       244M | Noticeably better on accented speech and proper nouns            |
| `whisper-medium`         |       769M | Rarely worth it in a browser                                     |
| `whisper-large-v3-turbo` |       809M | Best quality that is still browser-viable, needs WebGPU          |

Quantization (`q8`, `q4`) cuts the download several-fold with modest accuracy
loss. **Treat the byte sizes as an open question, not a planning input** — verify
against the specific ONNX model card before committing, because they vary by
quantization and by whether encoder and decoder are quantized alike. The shape of
the decision is: tens of megabytes at `tiny`/`base`, hundreds at `small`, close
to a gigabyte at `large-v3-turbo`.

Whatever the number, **it is a first-visit cost**, and it must be cached (Cache
API or OPFS) or every page load re-downloads a model.

### 6.3 How Transformers.js actually runs it

`@huggingface/transformers` compiles ONNX models to run in the browser through
ONNX Runtime Web, with a WebGPU backend and a WASM fallback. The API is the same
`pipeline` abstraction as the Python library:

```js
import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-base",
  { device: "webgpu", dtype: "q4" },
);

const output = await transcriber(audioFloat32Array, { language: "pt" });
// { text: "Quero viajar para uma praia em dezembro..." }
```

Two things are not optional:

**It must run in a Web Worker.** Inference on the main thread freezes the UI for
the entire decode — seconds, not milliseconds. The model loads and runs in a
worker; the hook talks to it by `postMessage`.

**WebGPU or it is too slow.** The WASM fallback works and is CPU-bound; on a
mid-range laptop it can run slower than real time on `small` and up. The hook
should feature-detect `navigator.gpu`, pick a smaller model on the fallback path,
and say so in the UI rather than appearing to hang.

### 6.4 Streaming versus batch

The Web Speech API streams interim results, which is why version 1 shows text
appearing as you speak. Whisper is a batch model: it transcribes a chunk of
audio, not a live stream.

Two options:

- **Batch.** Record with `MediaRecorder` until the user presses stop, then
  transcribe once. Simple, accurate (the model sees full context), but the
  transcript appears only after a pause. For this app — one sentence, then a
  search — that is perfectly acceptable and arguably a better UX than watching
  text rewrite itself.
- **Chunked pseudo-streaming.** Feed overlapping windows (e.g. 5s with 1s
  overlap) and stitch the outputs. Restores live feedback at the cost of
  stitching logic, duplicated words at boundaries, and worse accuracy from
  truncated context.

For a version 2, batch first. Chunking is real complexity for a cosmetic gain.

### 6.5 What the code becomes

The new hook keeps the existing interface, so nothing above it changes:

```ts
// frontend/hooks/useWhisperTranscription.ts
export function useWhisperTranscription({ lang }: { lang: string }) {
  // Same return shape as useSpeechRecognition:
  // { isSupported, isListening, transcript, error, start, stop, reset, setTranscript }
}
```

Under it, the flow is:

```
getUserMedia()
   → MediaRecorder / AudioWorklet
   → decode to Float32Array, 16 kHz mono   ← Whisper's required input format
   → postMessage to worker
   → transformers.js pipeline
   → text back to the hook
```

The resampling step is the one people forget: Whisper expects 16 kHz mono
`Float32Array`, and browsers capture at 44.1 or 48 kHz. `AudioContext` with a
`sampleRate` of 16000, or `OfflineAudioContext` for resampling, handles it.

A `NEXT_PUBLIC_STT_ENGINE=webspeech|whisper` flag lets both hooks coexist, which
is how you A/B them on real speech instead of arguing about them.

### 6.6 Alternatives to in-browser Whisper

| Option                                | When it wins                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Transformers.js + WebGPU**          | Privacy matters, users are on modern desktop browsers                                                        |
| **whisper.cpp compiled to WASM**      | You want tighter control and smaller runtime than ONNX Runtime Web                                           |
| **faster-whisper on your own server** | Mobile or low-end clients; one GPU serves everyone; audio leaves the device but stays on your infrastructure |
| **A hosted transcription API**        | Fastest to ship, best accuracy per unit of effort, but it is the thing we were trying to get away from       |

Note that a server-side Whisper is _not_ a privacy win over the Web Speech API —
it just changes which company holds the audio. Only the in-browser path removes
the transfer entirely.

### 6.7 Transcription trade-off summary

|                         | Web Speech API (v1)   | Whisper in browser     | Whisper on your server |
| ----------------------- | --------------------- | ---------------------- | ---------------------- |
| Audio leaves device     | Yes (Chrome → Google) | **No**                 | Yes (→ your server)    |
| Works in Firefox/Safari | No / partial          | **Yes**                | Yes                    |
| First-load cost         | None                  | Tens to hundreds of MB | None                   |
| Latency                 | Live, streaming       | Seconds after stop     | Network + inference    |
| Offline                 | No                    | **Yes**                | No                     |
| Infrastructure cost     | None                  | **None**               | GPU host               |
| Reproducible            | No                    | **Yes**                | **Yes**                |
| Works on low-end mobile | Yes                   | Poorly                 | **Yes**                |

---

## 7. Model B — local extraction

### 7.1 The task is small; the model does not need to be big

This is worth stating plainly, because it is the crux of whether local extraction
is realistic: the job is to turn one sentence into six fields, of which four are
closed enumerations (six categories, twelve months, three budget levels) and two
are simple values (a place name, a number).

That is not frontier-model work. It is closer to slot filling than to reasoning.
A well-prompted 3B–7B instruct model handles the common cases. Version 1 uses a
frontier model because it costs fractions of a cent at PoC volume and removes a
variable — not because the task demands it.

### 7.2 Constrained decoding is the whole trick

The reason a small local model is viable at all is that the schema guarantee
transfers. Left to free generation, a 3B model produces malformed JSON, invented
enum values, and markdown fences often enough to need a repair loop.

Constrained decoding removes the failure mode entirely. `llama.cpp` (GBNF
grammars), vLLM (`outlines` / `xgrammar`), and Ollama all support restricting
token sampling to what the grammar permits. Ollama takes a JSON Schema directly:

```python
response = client.chat(
    model="qwen2.5:7b-instruct",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": text},
    ],
    format=PREFERENCES_SCHEMA,   # the same dict already in llm_service.py
)
return TravelPreferences.model_validate_json(response.message.content)
```

Read that carefully: `PREFERENCES_SCHEMA` and `SYSTEM_PROMPT` are the **same
objects version 1 already sends to Anthropic**, and the return line is
byte-identical. The provider swap is roughly twenty lines because the contract
was made explicit rather than left implicit in a prompt.

This is the concrete answer to "how would you use a local model to do the data
extraction": you do not restructure anything. You add a branch to the existing
provider dispatch, point it at a schema-constrained local runtime, and the rest
of the system cannot tell the difference.

### 7.3 Option 1 — Ollama on a local machine or VPS

**Shape.** Ollama runs as a service; the backend calls it over HTTP. Model
choices in the useful range: `qwen2.5:7b-instruct` (strong multilingual, good
PT-BR), `llama3.1:8b-instruct`, `phi-4-mini` (smaller, English-leaning).

**Wins.** No per-user download. One model serves every request. Full control over
version. Marginal cost per request is zero. Data never leaves your infrastructure.

**Costs.** It is a server you now operate. On CPU, a 7B model takes seconds per
request; you want a GPU. That is a real monthly bill (see §9). And note the
honest framing: this is _self-hosted_, not _local to the user_ — from the user's
perspective their sentence still travels to a server.

### 7.4 Option 2 — the model in the browser (WebLLM)

**Shape.** WebLLM (MLC) compiles instruct models to WebGPU and runs them in the
tab. Realistic candidates are the 1.5B–3B instruct classes at 4-bit
quantization. Sizes are on the order of one to a few gigabytes — again, **verify
against the model card**, and note this stacks on top of the Whisper download
from §6.2.

**Wins.** Zero infrastructure and zero marginal cost, at any scale. Combined with
in-browser Whisper it makes the entire AI pipeline run on the user's device: no
audio, no transcript, no preferences ever leave the machine. That is a genuinely
strong claim, and it is only available on this path.

**Costs.** A multi-gigabyte first load is a hard sell for a consumer travel site.
RAM pressure with two models resident. Quality at 1.5B–3B is meaningfully below
7B. WebGPU required.

**Where it fits.** Kiosks, internal tools, offline-first apps, privacy-regulated
domains — anywhere you control the device or the user has a reason to accept the
download.

### 7.5 Option 3 — a fine-tuned encoder instead of an LLM

**Shape.** Treat it as what it is — intent classification plus slot filling — and
fine-tune a small encoder (BERT/DeBERTa class, or a multilingual variant for
PT-BR) with a classification head per enum field and token-level NER for
destination and amount.

**Wins.** Order-of-magnitude smaller and faster than any LLM here — hundreds of
megabytes at most, single-digit milliseconds on CPU, no GPU. Accuracy on the
closed enumerations can _exceed_ a general LLM, because the model is trained on
exactly this distribution.

**Costs.** You need labelled data — realistically a few thousand annotated
utterances. Adding a seventh field means relabelling and retraining, where an LLM
needs one line in a prompt. Zero generalization to phrasings outside the training
distribution.

**Where it fits.** Once the product is stable, the schema stops changing, and
volume makes per-request cost or latency matter. It is the right end state for a
mature version of this feature, and the wrong choice for version 2.

### 7.6 Option 4 — no model at all

Rules, regex, and a gazetteer. This is what `LLM_PROVIDER=mock` already is, and
it is worth naming as a real option: for a fixed catalogue of twelve packages and
six categories, a few hundred lines of keyword matching covers a surprising
fraction of real utterances.

It fails on everything version 1's prompt rules exist to handle — implicit
counting ("with my wife and two kids"), relative dates ("next month"), slang
("uns 5 mil paus"), and paraphrase ("somewhere warm" → beach). That gap is the
actual value the LLM adds, and measuring it against the rules baseline is the
cleanest way to justify the model's existence.

### 7.7 What you lose going local, concretely

The failures are not random — they cluster in inference that requires world
knowledge or arithmetic over language:

| Utterance                            | Frontier model                      | 3B local model, likely                          |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| "with my wife and two kids"          | `travelers: 4`                      | `travelers: 2` or null                          |
| "somewhere warm around New Year"     | `category: beach`, `month: January` | `month: January`, category null                 |
| "no verão" (PT, southern hemisphere) | `month: January`                    | null, or a northern-summer month                |
| "uns 5 mil paus" (slang)             | `max_budget: 5000`                  | null                                            |
| "não quero praia" (negation)         | category null                       | `category: beach` — **wrong, not just missing** |

That last row is the one to watch. Missing a field degrades results; _inverting_
one produces confidently wrong recommendations. Negation handling is where small
models fail most dangerously, and it should be an explicit line item in any
evaluation.

**How to decide instead of guessing.** Build an evaluation set — 100–200 real
utterances in PT and EN, hand-labelled with the correct six fields. Run every
candidate against it and report per-field accuracy, plus a separate count of
inversions. That turns "is a 3B model good enough" from an opinion into a number,
and it is a day of work.

### 7.8 Extraction trade-off summary

|                                 | Anthropic API (v1) | Ollama 7B self-hosted | WebLLM 3B in browser | Fine-tuned encoder   | Rules     |
| ------------------------------- | ------------------ | --------------------- | -------------------- | -------------------- | --------- |
| Extraction quality              | Highest            | High                  | Moderate             | High _in domain_     | Low       |
| Handles negation/slang/implicit | **Yes**            | Mostly                | Unreliable           | Only if trained      | No        |
| Schema guaranteed               | **Yes**            | **Yes** (grammar)     | Yes (grammar)        | N/A                  | N/A       |
| Latency                         | ~1–3 s             | ~0.5–2 s (GPU)        | 1–5 s                | **<50 ms**           | **<1 ms** |
| Marginal cost                   | Per request        | Zero                  | **Zero**             | **Zero**             | **Zero**  |
| Fixed cost                      | None               | GPU host              | None                 | Training + labelling | None      |
| Data leaves device              | Yes                | To your server        | **No**               | Depends              | **No**    |
| Effort to add a field           | One prompt line    | One prompt line       | One prompt line      | Relabel + retrain    | New rules |

---

## 8. What the fully local architecture becomes

With both models local and in the browser:

```
┌─────────────────────────── Browser ────────────────────────────┐
│  Microphone                                                    │
│      │                                                         │
│      ▼                                                         │
│  MediaRecorder → Float32Array 16 kHz mono                      │
│      │                                                         │
│      ▼   [Web Worker 1]                                        │
│  Whisper (Transformers.js, WebGPU)          ← Model A          │
│      │                                                         │
│      ▼   transcript                                            │
│      │                                                         │
│      ▼   [Web Worker 2]                                        │
│  Qwen2.5-3B-Instruct (WebLLM, WebGPU)       ← Model B          │
│  + JSON-Schema-constrained decoding                            │
│      │                                                         │
│      ▼   TravelPreferences (JSON)                              │
└──────┼─────────────────────────────────────────────────────────┘
       │  POST /api/recommendations  { preferences }
       ▼
┌───────────────────────── FastAPI ──────────────────────────────┐
│  search_service.search_packages  →  SQLite  →  ranked results   │
└─────────────────────────────────────────────────────────────────┘
```

Two consequences worth noting:

**The backend loses its AI dependency entirely.** It becomes a search service
over SQLite. `llm_service.py` disappears from the request path; no API key, no
provider configuration, no 502/503 error branches.

**A new endpoint is needed.** The backend would accept `{ preferences }` directly
rather than `{ text }`, because extraction now happens client-side. That is a
genuine API change — and the one place in this migration where the version 1
contract does not survive untouched. Keeping the `{ text }` endpoint alongside it
(server-side extraction as a fallback for devices without WebGPU) is probably
right, which means both paths coexist rather than one replacing the other.

**And a warning that follows from it:** once preferences arrive from the client,
they are user-controlled input. Version 1 receives them from a trusted internal
call; version 2 would receive them over HTTP. Pydantic validation already
constrains the enums, but the endpoint would need the same scrutiny as any public
input — this is a security consideration the current architecture does not have.

---

## 9. Cost model — what you are actually saving

Version 1's per-request cost, using the actual prompt (923 characters ≈ 230
tokens) plus the schema and a short sentence:

- Input ≈ 500 tokens, output ≈ 60 tokens
- **Claude Opus 5** ($5/$25 per MTok): (500 × 5 + 60 × 25) / 1,000,000 ≈ **$0.004**
- **Claude Haiku 4.5** ($1/$5 per MTok): (500 × 1 + 60 × 5) / 1,000,000 ≈ **$0.0008**

Note the prompt caching subtlety: the stable prefix here is ~450 tokens, right at
the 512-token minimum for a cacheable prefix on Opus 5. It would likely _not_
cache without padding the system prompt — worth knowing before assuming a
discount.

At volume:

| Requests / month | Opus 5 | Haiku 4.5 | Self-hosted GPU | In-browser |
| ---------------: | -----: | --------: | --------------: | ---------: |
|            1,000 |     $4 |     $0.80 |           ~$150 |         $0 |
|           10,000 |    $40 |        $8 |           ~$150 |         $0 |
|          100,000 |   $400 |       $80 |           ~$150 |         $0 |
|        1,000,000 | $4,000 |      $800 |          ~$150+ |         $0 |

The conclusion is not the obvious one. **Self-hosting a GPU to save API cost is a
losing trade until roughly 190,000 requests per month** (a ~$150/mo GPU host
against Haiku at $0.0008). Below that, the API is cheaper _and_ better _and_ has
no operational burden.

So cost is a bad reason to go local at PoC scale. Privacy, offline capability,
browser coverage, and reproducibility are the good reasons — and in-browser is
the only option that delivers privacy while also costing nothing.

---

## 10. Migration plan

**Phase 0 — Measure before changing anything.** Build the 100–200 utterance
evaluation set from §7.7. Record the current pipeline's per-field accuracy and
latency. Without this, every later comparison is anecdote.

**Phase 1 — Whisper behind a flag.** Add `useWhisperTranscription`, gate it on
`NEXT_PUBLIC_STT_ENGINE`, run both against the same recorded audio. This is the
highest-value change: it fixes Firefox/Safari, removes the audio transfer to
Google, and does not touch the backend at all.

**Phase 2 — Local extraction behind a flag.** Add `LLM_PROVIDER=ollama` beside
`anthropic` and `mock`, reusing `PREFERENCES_SCHEMA` and `SYSTEM_PROMPT`
unchanged. Run it against the evaluation set. Decide on the numbers, especially
the inversion count.

**Phase 3 — Only if fully-offline is a requirement.** Move extraction into the
browser with WebLLM, add the `{ preferences }` endpoint, keep the `{ text }`
endpoint as the fallback for devices without WebGPU, and treat the new endpoint's
input as untrusted.

Each phase is independently shippable and independently revertible, and phases 1
and 2 touch opposite sides of the system.

---

## 11. Recommendation

**Do Phase 1. Be skeptical about Phase 2. Do Phase 3 only if someone requires it.**

Local Whisper is a clear win with a bounded cost: it removes the audio transfer
to a third party, doubles browser coverage, improves PT-BR proper nouns, and
makes transcription reproducible. The price is a first-load download and a Web
Worker. Nothing about the backend changes.

Local extraction is a different proposition. The frontier model earns its keep on
exactly the cases that make voice input feel intelligent — implicit counting,
negation, slang, seasonal inference — and it costs well under a cent per request.
Replacing it saves almost nothing at realistic volume and risks the failure mode
that matters most, which is confident inversion rather than graceful omission.

The honest version of the recommendation is that the _architecture_ should be
ready for local extraction — and it is, because the provider branch and the
schema contract already exist — while the _default_ stays on the API until an
evaluation says otherwise, or until a privacy or offline requirement makes the
decision for you.
