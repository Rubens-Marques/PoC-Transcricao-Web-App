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
  [DOCUMENTACAO.md](DOCUMENTACAO.md) §6.1. É a única etapa da cadeia que ainda
  sai da máquina.)
- **O LLM** roda **localmente** por padrão: `qwen2.5:3b` via Ollama, ~1,9 GB em
  disco. Ele é usado estritamente como parser — entra uma frase, sai um objeto
  JSON — e nunca conversa. A API hospedada da Anthropic continua disponível
  trocando uma variável de ambiente.
- **A busca** é pontuação determinística por pesos sobre uma tabela SQLite. Sem
  aprendizado, sem embeddings.

> **Sigilo.** Com `LLM_PROVIDER=ollama`, o texto transcrito não sai desta
> máquina: nem a frase, nem as preferências extraídas, nem o catálogo. O áudio
> ainda vai para o Google enquanto a transcrição usar a Web Speech API — fechar
> essa última brecha exige Whisper local, descrito em
> [DOCUMENTACAO.md](DOCUMENTACAO.md) §6.

> **[DOCUMENTACAO.md](DOCUMENTACAO.md)** (também em inglês:
> **[DOCUMENTATION.en.md](DOCUMENTATION.en.md)**) — o registro completo de decisões de
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
| IA       | `qwen2.5:3b` local via Ollama (padrão) ou Anthropic Messages API |

---

## Estrutura do projeto

```
POC/
├── backend/
│   ├── main.py                     # create_app(), CORS, lifespan
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── recommendations.py      # POST /api/recommendations
│   │   ├── place.py                # POST /api/place
│   │   └── signup.py               # POST /api/signup/interpret
│   ├── services/
│   │   ├── llm_service.py          # extract_travel_preferences(text)
│   │   ├── signup_service.py       # interpret_signup_answer(field, text)
│   │   └── search_service.py       # pontuação determinística
│   ├── models/
│   │   ├── travel.py               # contratos Pydantic
│   │   └── signup.py               # contratos do cadastro conversado
│   ├── database/
│   │   ├── db.py                   # conexão + schema
│   │   └── seed.py                 # 35 pacotes em 10 países
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

Pré-requisitos: **Python 3.11+**, **Node.js 20+** e **Ollama**.

### 1. Modelo local

```bash
brew install ollama          # ou https://ollama.com/download
ollama serve &               # deixa o daemon no ar em localhost:11434
ollama pull qwen2.5:3b       # ~1,9 GB, baixado uma vez
```

Para deixar o daemon subindo junto com o login: `brew services start ollama`.

Precisa de ~2,5 GB de RAM livre enquanto responde. Se sua máquina tiver folga,
`qwen2.5:7b` erra menos em negação e contagem implícita — troque com
`LLM_MODEL=qwen2.5:7b`.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # depois edite — ver "Variáveis de ambiente" abaixo
python -m database.seed   # cria data/travel.db com 35 pacotes

uvicorn main:app --reload
```

A API escuta em <http://localhost:8000>. Documentação interativa em
<http://localhost:8000/docs>.

### 3. Frontend

Em um terceiro terminal:

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

| Variável        | Obrigatória | Padrão                   | Observações                            |
| --------------- | ----------- | ------------------------ | -------------------------------------- |
| `LLM_PROVIDER`  | não         | `ollama`                 | `ollama`, `anthropic` ou `mock`        |
| `OLLAMA_HOST`   | não         | `http://localhost:11434` | Onde o daemon do Ollama escuta         |
| `LLM_API_KEY`   | sim¹        | —                        | Chave da API, só para `anthropic`      |
| `LLM_MODEL`     | não         | conforme o provider²     | Sobrescreve o modelo do provider ativo |
| `CORS_ORIGINS`  | não         | `http://localhost:3000`  | Separadas por vírgula                  |
| `DATABASE_PATH` | não         | `backend/data/travel.db` |                                        |
| `LOG_LEVEL`     | não         | `INFO`                   |                                        |

¹ Obrigatória apenas quando `LLM_PROVIDER=anthropic`.
² `qwen2.5:3b` para `ollama`, `claude-opus-5` para `anthropic`.

Os três providers valem a pena distinguir:

| Provider    | Onde roda     | Os dados saem da máquina? |
| ----------- | ------------- | ------------------------- |
| `ollama`    | Sua máquina   | **Não**                   |
| `anthropic` | API hospedada | Sim                       |
| `mock`      | Sua máquina   | **Não**                   |

**`LLM_PROVIDER=ollama`** é o padrão. Constrained decoding via `format=<schema>`
garante que a saída obedeça ao JSON Schema — a mesma garantia que a API
hospedada dá. Um modelo de 3B só consegue ser usado aqui por causa disso.

> ⚠️ Um modelo do Ollama cujo nome termina em `-cloud` (ex.: `qwen3.5:397b-cloud`)
> **roda nos servidores da Ollama**, não na sua máquina. Não use um deles em
> `LLM_MODEL` se o ponto for manter os dados locais.

**`LLM_PROVIDER=mock`** troca a chamada por casamento de palavras-chave local
(PT e EN). Existe para que a cadeia inteira possa ser testada em CI sem daemon e
sem chave. É apoio de teste, não fallback: entende um punhado de palavras-chave,
não linguagem.

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
idioma falado — é o schema que define isso. A UI apenas os enfeita com emoji
(`beach` → `🏖️ Beach`); ela ainda não traduz os rótulos para português.

`score` e `match_reasons` são acréscimos ao formato mínimo do spec. Eles tornam o
ranking auditável, que é boa parte do propósito de uma demonstração de PoC.

**Erros**

| Status | Quando                                                                 |
| ------ | ---------------------------------------------------------------------- |
| `422`  | `text` ausente, vazio ou acima de 1000 caracteres                      |
| `502`  | O LLM respondeu mas a resposta era inutilizável (ou ele recusou)       |
| `503`  | O provider de LLM está mal configurado — ex.: `LLM_API_KEY` não setada |

### `POST /api/signup/interpret`

Entende **uma** resposta do cadastro conversado. O cliente diz qual pergunta
fez; o serviço devolve só o que aquela pergunta pede.

**Requisição**

```json
{ "field": "maritalStatus", "text": "casado há 20 anos" }
```

| Campo   | Tipo   | Restrições                                                                     |
| ------- | ------ | ------------------------------------------------------------------------------ |
| `field` | enum   | `name` `email` `birthDate` `place` `maritalStatus` `children` `hobbies`        |
| `text`  | string | 1 a 280 caracteres (o mesmo teto do campo de conversa no cliente)              |

**Resposta `200`**

```json
{
  "answer": {
    "full_name": null,
    "email": null,
    "birth_date": null,
    "age": null,
    "city": null,
    "state": null,
    "country": null,
    "marital_status": "casado",
    "has_minor_children": null,
    "minor_children_count": null,
    "hobbies": []
  }
}
```

Todo campo é opcional: a resposta pode não conter o que foi perguntado, e
inventar valor seria pior do que reperguntar. O cliente valida o que chega
(email, data) antes de gravar no perfil.

Diferente das preferências de viagem, os valores aqui saem em **português** —
é o cadastro da própria pessoa, exibido para ela.

**Erros**

| Status | Quando                                                     |
| ------ | ---------------------------------------------------------- |
| `422`  | `field` desconhecido, ou `text` vazio/acima de 280          |
| `502`  | O modelo respondeu algo inutilizável                        |
| `503`  | Provider mal configurado ou Ollama fora do ar               |

Se este endpoint falhar, o cliente **não** interrompe o cadastro: cai no parser
local e a pessoa termina o que começou.

### `GET /health`

```json
{ "status": "ok", "provider": "ollama" }
```

---

## Como funciona a extração

`extract_travel_preferences(text)` manda a frase para o provider ativo com o
**mesmo JSON Schema** anexado, seja qual for o provider:

| Provider    | Como o schema é imposto     |
| ----------- | --------------------------- |
| `ollama`    | `format=PREFERENCES_SCHEMA` |
| `anthropic` | `output_config.format`      |

Nos dois casos a restrição acontece durante a geração, então a resposta é sempre
JSON válido no formato esperado — não há prompt de reparo nem adivinhação com
`try: json.loads()`. É isso que torna um modelo de 3B utilizável aqui: ele não
consegue emitir JSON malformado nem um valor de enum inventado. Só a _semântica_
pode sair errada.

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

### O que o modelo não decide

Duas inferências foram tiradas do modelo e movidas para código, depois de medir
que ele errava:

**Estação → mês** (`backend/services/season.py`). Instruído a aplicar o
hemisfério conforme o país, o `qwen2.5:3b` respondia "verão" → June e "inverno"
→ July para qualquer país. Ele agora extrai `season` como fato bruto, e o código
deriva o mês. Quando o modelo devolve mês e estação juntos, vence o que for
consistente: julho no verão português é preservado, junho no verão brasileiro é
substituído por janeiro.

O princípio geral: um modelo de 3B extrai fatos bem e faz lógica condicional
mal. Peça o fato, calcule a derivação.

---

## Como funciona a busca

Cada pacote é pontuado contra as preferências extraídas, do maior para o menor,
com empates desfeitos pelo menor preço. Os pesos codificam a ordem de prioridade
do spec:

| Sinal                                  | Peso |
| -------------------------------------- | ---: |
| Cidade/região nomeada pelo usuário     |  400 |
| País nomeado pelo usuário              |  120 |
| Categoria casa                         |  100 |
| Mês está na melhor temporada do pacote |   50 |
| Preço cabe no orçamento                |   25 |
| Grupo cabe na capacidade do pacote     |   10 |

`destination` e `country` são campos separados de propósito: quem diz "quero ir
para a Itália" não nomeou cidade, e quem diz "Gramado" não nomeou país. Forçar um
campo só fazia o modelo escolher entre os dois — e escolher errado.

A cidade fica deliberadamente acima da soma de todo o resto (305): se alguém
nomeia um lugar específico, isso vence um pacote que casa com todos os critérios
moles em outro lugar. Um teste falha se alguém subir outro peso sem ajustar este.

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

46 testes cobrindo as regras de pontuação, a resolução de estações, o contrato de
extração e o endpoint HTTP. A suíte roda offline: `tests/conftest.py` força
`LLM_PROVIDER=mock` e aponta o banco para um diretório temporário, então nem
chave de API nem daemon do Ollama são necessários, e o `data/travel.db` populado
nunca é tocado.

Os testes verificam o _contrato_ da extração — que sai um `TravelPreferences`
válido. Se o conteúdo está **certo** é outra pergunta, e nenhum teste unitário
responde.

## Avaliação da extração

```bash
cd backend
LLM_PROVIDER=ollama LLM_MODEL=qwen2.5:3b python -m eval.run_eval
```

[`eval/cases.json`](backend/eval/cases.json) tem 40 frases rotuladas à mão em PT
e EN, agrupadas por classe de dificuldade: país vs cidade, tipo-de-lugar que não
é destino, estações nos dois hemisférios, contagem implícita, orçamento por
número e por palavra, negação, e frases que não dizem nada.

O relatório sai por classe, o que mostra **onde** o modelo erra em vez de só
quanto. É assim que se compara dois modelos ou duas versões do prompt sem
depender de impressão.

Isto não passa nem falha — mede. Rodar contra a VPS sem instalar modelo local:

```bash
docker compose exec backend python -m eval.run_eval
```

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
- O catálogo são 35 linhas fixas carregadas por um script de seed
  (`backend/database/seed.py`), em 10 países.
- As queries SQLite rodam de forma síncrona dentro de rotas async. O conjunto de
  dados são uma dúzia de linhas locais, então a janela de bloqueio é desprezível;
  o caminho de evolução está marcado com um comentário `ponytail:` em
  `backend/database/db.py`.
- O `npm audit` reporta 3 vulnerabilidades de severidade alta em `postcss` e
  `sharp`, ambas dependências transitivas embutidas no Next.js 16.2.12. O
  `npm audit fix --force` "resolve" rebaixando para o Next.js 9 — não rode. São
  problemas de toolchain de build, sem exposição em runtime para uma PoC local;
  somem quando o Next publicar um bundle atualizado.

### Sobre a qualidade do modelo local

Um modelo de 3B erra em inferências que exigem conhecimento de mundo. O prompt em
`OLLAMA_SYSTEM_PROMPT` corrige por escrito cada falha observada — nomes de
categoria vazando para `destination`, faixas de orçamento aplicadas por
impressão em vez de aritmética, estações lidas como hemisfério norte, e
`travelers` defaultando para 1 sem ninguém ter sido mencionado.

Num conjunto de 9 frases em PT e EN, a acurácia por campo foi de **100%**, com
latência mediana de **1,3s**. Esse número é otimista: o prompt foi ajustado
olhando parte dessas mesmas frases, então não é um conjunto held-out. Antes de
confiar nele em produção, monte um conjunto de avaliação independente conforme
[DOCUMENTACAO.md](DOCUMENTACAO.md) §7.7.

### Ainda fora de escopo

Apps mobile e Electron. E a transcrição continua na Web Speech API do browser —
substituí-la por Whisper local + WebGPU é o passo que falta para a cadeia inteira
rodar sem sair da máquina, descrito em [DOCUMENTACAO.md](DOCUMENTACAO.md) §6.
