# Documentação Técnica

> Também disponível em inglês: [DOCUMENTATION.en.md](DOCUMENTATION.en.md). As
> duas versões são equivalentes; identificadores de código, nomes de arquivo e
> termos técnicos consagrados permanecem em inglês nas duas.

Duas partes:

- A **Parte I** registra o que foi construído na versão 1, como cada peça
  funciona e por que cada escolha foi feita em detrimento das alternativas
  descartadas.
- A **Parte II** responde a uma pergunta prospectiva: o que muda se os dois
  modelos de IA saírem de uma API externa para modelos locais — Whisper para
  transcrição e um LLM pequeno para extração de dados.

A Parte II é **projeto, não implementação**. O spec da versão 1 proíbe
explicitamente modelos locais; nada da Parte II está presente no código.

---

# Parte I — O que foi construído

## 1. A cadeia

A PoC existe para provar que uma sequência funciona de ponta a ponta:

```
Voz → Texto → LLM → Dados Estruturados → Busca no Banco → Recomendação
```

Cada seta é uma fronteira onde algo pode falhar, e cada uma foi construída para
que a falha seja visível em vez de silenciosa.

| Etapa                      | Onde roda   | Componente                                 |
| -------------------------- | ----------- | ------------------------------------------ |
| Voz → Texto                | Browser     | Web Speech API, via `useSpeechRecognition` |
| Texto → Dados Estruturados | API externa | `llm_service.extract_travel_preferences`   |
| Dados Estruturados → Busca | Backend     | `search_service.search_packages`           |
| Busca → Recomendação       | Browser     | `ResultsList` / `PackageCard`              |

A ideia central de projeto é que **o LLM é um parser, não um conversador**. Ele
recebe uma frase e devolve um objeto JSON. Não tem memória, não tem ferramentas,
não dialoga e não opina no ranking. Isso mantém a superfície de IA pequena o
bastante para ser raciocinada, e significa que uma resposta ruim do modelo produz
um _filtro_ ruim, nunca um _motor de recomendação_ ruim.

---

## 2. Registro de decisões, camada por camada

### 2.1 Voz para texto — Web Speech API

**O quê.** `useSpeechRecognition` encapsula `window.SpeechRecognition` /
`window.webkitSpeechRecognition` com `continuous: true` e `interimResults: true`.

**Por quê.** O spec exige, e para uma versão 1 é a escolha certa de qualquer
forma: zero infraestrutura, zero download de modelo, nenhum endpoint de upload de
áudio para construir ou proteger, e funciona no instante em que a página carrega.

**Como a transcrição é acumulada.** A API emite tanto palpites intermediários
quanto trechos finalizados, e revisa os palpites intermediários conforme você
continua falando. Concatenar todo resultado ingenuamente duplica texto. Então os
trechos finalizados acumulam numa ref, e o texto intermediário é anexado apenas
para exibição:

```ts
if (result.isFinal) {
  finalTranscriptRef.current =
    `${finalTranscriptRef.current} ${alternative.transcript}`.trim();
} else {
  interim += alternative.transcript;
}
setTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
```

**Por que os tipos são locais.** A Web Speech API é um spec em rascunho. O
`lib.dom.d.ts` vem adicionando essas interfaces incrementalmente, então declará-las
globalmente arrisca quebrar o build por identificador duplicado em uma versão
futura do TypeScript. Em vez disso, o hook define interfaces estruturais `…Like`
localmente e estreita `window` com um único cast. Não pode colidir com nada.

**Por que a caixa de transcrição é editável.** O Firefox não implementa a Web
Speech API e o suporte do Safari é parcial. Se a transcrição fosse somente
leitura, a demo seria indemonstrável em dois dos três browsers principais. Um
`textarea` não custa nada e torna as quatro etapas restantes da cadeia
comprováveis digitando.

**O que foi aceito como custo.** Nenhum controle sobre o modelo de
reconhecimento, nenhuma operação offline, nenhum timestamp e — importante — a
implementação do Chrome envia o áudio capturado para os servidores do Google para
reconhecimento. "No browser" significa _nenhum áudio toca o nosso backend_; não
significa que o áudio fica no dispositivo. A Parte II trata exatamente disso.

---

### 2.2 Camada de LLM — API externa usada como parser

**O quê.** `extract_travel_preferences(text)` envia uma frase para a Messages API
da Anthropic e devolve um objeto `TravelPreferences` validado.

**Por que structured outputs em vez de prompt-e-parse.** A requisição anexa um
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

A conformidade com o schema é garantida server-side durante a geração. A
consequência prática é que uma categoria inteira de código não existe neste
repositório: nenhum retry para JSON inválido, nenhum "prompt de reparo", nenhum
regex para remover cerca de ```json, nenhum `try: json.loads()` defensivo. A
resposta ou é válida, ou a requisição falhou de forma barulhenta.

Esta é também a decisão mais importante para a Parte II, porque define um
contrato que sobrevive a uma troca de modelo — ver §7.2.

**Por que todo campo é nullable.** Uma frase falada raramente menciona os seis
campos. A alternativa — campos obrigatórios com valores-sentinela — força o
modelo a inventar valores, e um `month` inventado corrompe a busca silenciosamente.
O system prompt reforça: _"Only fill a field the speaker actually expressed. Never
guess."_

**Por que o schema é escrito à mão em vez de gerado do Pydantic.** Structured
outputs exigem `additionalProperties: false` e toda propriedade listada em
`required`; o Pydantic não emite nenhum dos dois por padrão para campos opcionais.
Em vez de pós-processar a saída gerada, o schema é explícito. A divergência é
evitada de duas formas: os valores de enum derivam dos mesmos tipos `Literal` via
`typing.get_args`, e um teste afirma que o conjunto de campos do schema é igual a
`TravelPreferences.model_fields`.

**Por que `effort: "low"`.** Extração é trabalho raso — sem raciocínio de
múltiplas etapas, sem uso de ferramentas. Effort baixo mantém o loop de voz
responsivo. O thinking fica ligado (o padrão) em vez de desabilitado, porque
desabilitá-lo nesta classe de modelo tem modos de falha documentados e a economia
de latência não os justifica.

**Por que o system prompt diz o que diz.** Cada regra existe por causa de uma
falha específica que ela evita:

| Regra do prompt                                             | Falha que evita                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| "canonical English tokens regardless of input language"     | Entrada em PT gerando `"praia"`, que não casa com nenhuma categoria   |
| "`travelers` counts every person… 'with my wife' is 2"      | Erro de um contra `max_people`                                        |
| "a stated number also implies a `budget_level`"             | `max_budget` preenchido, `budget_level` nulo — filtros inconsistentes |
| "`destination` is the place name only, without the country" | `"Gramado, Brazil"` falhando no casamento por substring               |
| "Never guess. Use null otherwise."                          | Meses alucinados estreitando os resultados de forma errada            |

**Recusas são tratadas.** `stop_reason == "refusal"` é verificado antes de ler
`response.content`, porque numa recusa o array de conteúdo pode vir vazio — código
que indexa `content[0]` incondicionalmente levantaria um erro sem relação com a
causa.

---

### 2.3 O contrato — um schema, dois consumidores

`backend/models/travel.py` define `TravelPreferences` uma vez. Ele é
simultaneamente o tipo de saída do LLM, o tipo de entrada da função de busca e
parte do corpo da resposta HTTP. `frontend/types/travel.ts` espelha isso.

Isso importa mais do que parece. A fronteira do LLM é o único lugar do sistema
onde uma resposta externa sem tipo entra, e ela é convertida em objeto tipado
exatamente nessa fronteira — `TravelPreferences.model_validate_json(payload)`.
Nada rio abaixo lida com saída bruta do modelo. Se o formato mudar, a falha é um
erro de validação na junção, não um `KeyError` três camadas adiante.

---

### 2.4 Abstração de provider e o mock

`LLM_PROVIDER` seleciona entre `anthropic` e `mock`. O mock é casamento de
palavras-chave local sobre termos em PT e EN, com remoção de acentos e um regex
para valores monetários.

**Por que existe.** Duas razões concretas, e nenhuma delas é "fallback":

1. A suíte de testes roda offline e sem API key. O CI nunca precisa de um secret,
   e os testes nunca geram cobrança.
2. A cadeia pode ser demonstrada com a camada de API removida, o que isola se um
   problema está na extração ou na busca.

**Por que explicitamente não é um fallback.** Ele entende uma lista fixa de
palavras-chave, não linguagem. Degradar silenciosamente para ele em produção
transformaria uma falha barulhenta numa resposta silenciosamente errada. Então um
provider mal configurado levanta `LLMConfigurationError` e o endpoint devolve 503
— nunca cai para o mock.

---

### 2.5 Banco de dados — SQLite via `sqlite3` da stdlib

**O quê.** Uma tabela, `travel_packages`, 12 linhas carregadas por
`python -m database.seed`.

**Por que nenhum ORM.** A escada de decisão — precisa existir, já existe, está na
biblioteca padrão, é uma dependência que já temos — para na biblioteca padrão. Há
uma tabela, uma query e nenhum relacionamento. SQLAlchemy adicionaria uma
dependência, um ciclo de vida de sessão e uma história de migrations a uma PoC que
não tem nenhum desses problemas.

**Por que `best_months` é uma string JSON.** SQLite não tem tipo array. As
alternativas são uma tabela de junção (uma segunda tabela e um join para uma lista
de no máximo doze strings) ou uma string delimitada (que convida a bugs de
substring — o padrão é frágil). Uma coluna JSON parseada com `json.loads` é
honesta sobre o que é e custa uma linha.

**A correção de threading, e por que não é só um artefato de teste.** A primeira
execução dos testes falhou com `SQLite objects created in a thread can only be
used in that same thread`. A causa é arquitetural, não específica de teste: o
FastAPI resolve dependências síncronas em uma worker thread, enquanto o corpo da
rota `async def` roda no event loop. A conexão é genuinamente criada em uma thread
e usada em outra. `check_same_thread=False` é correto aqui porque
`get_connection` entrega uma conexão por request e a fecha num `finally` — não há
compartilhamento entre requests concorrentes. Se isso só tivesse sido notado em
produção, teria aparecido como um 500 aleatório.

**O teto documentado.** As queries rodam de forma síncrona dentro de rotas async.
Para uma dúzia de linhas locais a janela de bloqueio é de microssegundos. O limite
e seu caminho de evolução estão marcados com um comentário `ponytail:` em
`database/db.py`, em vez de resolvidos preventivamente.

---

### 2.6 Busca — pontuação determinística por pesos

**O quê.** Cada pacote é pontuado contra as preferências; os 5 melhores são
devolvidos.

| Sinal                                  | Peso |
| -------------------------------------- | ---: |
| Destino nomeado pelo usuário           |  200 |
| Categoria casa                         |  100 |
| Mês está na melhor temporada do pacote |   50 |
| Preço cabe no orçamento                |   25 |
| Grupo cabe na capacidade do pacote     |   10 |

**Por que pesos e não filtros.** Uma cadeia de `WHERE` rígidos devolve nada no
momento em que um critério é insatisfazível — peça uma praia em julho abaixo de
R$ 2.000 e você recebe uma página vazia. A pontuação degrada com elegância: o
melhor casamento disponível aparece, e `match_reasons` diz exatamente quais
critérios ele atendeu e quais não.

**Por que 200 para destino.** A lista de prioridades do spec começa em categoria,
mas o schema de extração tem um campo `destination`. Extraí-lo e depois ignorá-lo
seria um buraco no pipeline. Ele é ponderado acima da _soma_ de todos os outros
pesos (185) deliberadamente: se alguém nomeia um lugar, isso vence um pacote que
casa com todo critério mole em outro lugar. Um teste afirma essa invariante
diretamente, pontuando um pacote com o lugar nomeado que não casa com mais nada
contra um rival que casa com tudo o mais.

**Por que um `max_budget` explícito sobrepõe `budget_level`.** "Viagem de luxo,
mas não mais que 4000" é uma frase coerente. O número declarado é a restrição mais
dura e vence.

**Por que pacotes com zero são descartados — mas só às vezes.** Se ao menos uma
preferência foi extraída, um pacote que não casa com nenhuma é ruído. Se _nada_
foi extraído, descartar tudo devolveria uma página vazia para um pedido vago; os
pacotes mais baratos são devolvidos no lugar.

**Por que empates são desfeitos pelo preço.** Determinismo. Dois pacotes de praia
em dezembro com pontuação idêntica precisam ordenar da mesma forma em toda
execução, ou a demo parece aleatória.

**Por que `match_reasons` está na resposta.** Torna o ranking auditável. Numa PoC,
"por que ele escolheu aquele?" é a primeira pergunta que qualquer um faz, e a
resposta deveria estar na tela em vez de nos logs.

---

### 2.7 API HTTP — um endpoint, três modos de falha

`POST /api/recommendations` é o pipeline inteiro. A taxonomia de erros distingue
causas que exigem respostas diferentes:

| Status | Significado                                         | Quem corrige      |
| ------ | --------------------------------------------------- | ----------------- |
| 422    | `text` ausente, vazio ou acima de 1000 caracteres   | Quem chamou       |
| 502    | O provider respondeu, a resposta era inutilizável   | Retry pode ajudar |
| 503    | O provider está mal configurado (sem `LLM_API_KEY`) | O operador        |

Um único 500 para os três tornaria uma variável de ambiente faltando
indistinguível de uma recusa do modelo.

A resposta é um superconjunto do formato mínimo do spec — campos completos do
pacote mais `score` e `match_reasons` — porque a UI renderiza cards, e um segundo
round-trip para detalhes seria inútil neste tamanho.

---

### 2.8 Frontend — App Router, um hook, um ponto de troca

**O quê.** Next.js 16 App Router, React 19, TypeScript em modo estrito (mais
`noUncheckedIndexedAccess`), Tailwind CSS v4.

**Por que App Router em vez de `pages/`.** O esboço de estrutura do spec dizia
`/pages`, mas o App Router é o padrão atual do Next.js e o `pages` router é
legado. O mapeamento é direto: `app/page.tsx` + `components/` + `services/`.

**Por que uma única árvore de client components.** A página é uma superfície
interativa única; não há nada para renderizar no servidor. `page.tsx` é dono do
estado de resultados, `VoiceRecorder` é dono do estado de fala. O estado vive no
nível mais baixo que precisa dele.

**Por que `PreferencesSummary` existe.** Ele renderiza o que o LLM entendeu. Sem
ele a etapa de extração é invisível — você fala, cards aparecem, e a camada de IA
é uma caixa-preta não examinada. Mostrar os seis campos extraídos é o que faz
disto uma _demonstração_ da cadeia em vez de uma caixa de busca.

**O ponto de troca que importa.** `useSpeechRecognition` devolve uma interface
deliberadamente genérica:

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

Nada nesse formato menciona a Web Speech API. Ele descreve _transcrição_, não uma
implementação dela. A Parte II depende disso.

---

### 2.9 Configuração e secrets

Nenhum secret no código. `.env` e `.env.local` estão no gitignore; apenas os
templates `.example` são commitados. As origens de CORS vêm do ambiente em vez de
um wildcard, e credenciais estão desabilitadas no middleware de CORS, já que a API
não tem cookies nem autenticação.

---

### 2.10 Testes

23 testes, todos offline. `tests/conftest.py` força `LLM_PROVIDER=mock` e aponta o
banco para um diretório temporário antes que qualquer módulo da aplicação seja
importado, então a suíte não precisa de API key e nunca toca o `data/travel.db`
populado.

**O que é testado e por quê.** A cobertura mirou comportamento, não linhas. A
camada de pontuação é o único lugar desta PoC com lógica de ramificação real, então
recebe a maior parte dos testes — incluindo a invariante de destino-vence-tudo, a
regra `max_budget`-vence-`budget_level` e o fallback sem critérios. A camada de
extração é testada quanto ao _contrato_ (sai um `TravelPreferences` válido; o
schema e o modelo Pydantic concordam) em vez de qualidade do modelo, que não é
algo que um teste unitário possa afirmar. A camada de API é testada de ponta a
ponta com `TestClient`, que foi o que pegou o bug de threading do SQLite.

---

## 3. Bugs encontrados na verificação

Os dois foram encontrados executando o código, não lendo.

**1. Conexão SQLite cruzando threads.** Descrito em §2.5. Um defeito real que
teria aparecido em produção como um 500 intermitente.

**2. O peso de destino contradizia o próprio comentário.** O código documentava
"um destino explícito supera todos os outros" enquanto o ponderava em 150 contra
185 possíveis da soma dos demais sinais. O teste escrito para afirmar o
comportamento documentado falhou. A correção elevou o peso para 200 em vez de
enfraquecer o teste, porque a intenção documentada era a correta.

---

## 4. O que foi verificado, e como

| Verificação                                  | Método                                | Resultado                          |
| -------------------------------------------- | ------------------------------------- | ---------------------------------- |
| Pontuação, contrato de extração, camada HTTP | `pytest`                              | 23 passaram                        |
| Segurança de tipos                           | `tsc --noEmit`                        | Limpo                              |
| Build de produção                            | `next build`                          | Compila, type-check passa          |
| Comportamento da API                         | `curl` contra servidor rodando        | Preferências e ranking corretos    |
| Fluxo completo da UI                         | Browser, transcrição digitada → busca | Cards renderizam, console sem erro |
| Layout responsivo                            | Browser em 375×812                    | Sem overflow                       |
| Formato da chamada ao SDK Anthropic          | Introspecção de assinatura e schema   | Parâmetros válidos                 |

**Não verificado: a chamada real à API da Anthropic.** Nenhuma API key estava
disponível. O formato da requisição, os nomes dos parâmetros e o schema foram
validados estruturalmente, e o caminho de tratamento da resposta é exercitado pelo
provider mock, mas o round-trip de rede em si não foi testado. Essa é a única
lacuna na verificação acima.

---

# Parte II — Versão 2 com modelos locais

## 5. O que "local" muda, e os dois pontos de troca que barateiam isso

A versão 1 usa duas capacidades de IA externas. A versão 2 substitui ambas por
modelos que rodam em hardware que você controla:

|                            | Versão 1                                    | Versão 2                    |
| -------------------------- | ------------------------------------------- | --------------------------- |
| **Modelo A** — transcrição | Web Speech API (Chrome → servidores Google) | Whisper, no browser         |
| **Modelo B** — extração    | Anthropic Messages API                      | LLM instruct pequeno, local |

A migração é barata porque a versão 1 foi construída com exatamente dois pontos
de troca, e nenhum deles vaza sua implementação:

1. **`useSpeechRecognition` devolve estado de transcrição, não estado da Web
   Speech.** Um hook `useWhisperTranscription` com o mesmo formato de retorno é
   substituto direto. `VoiceRecorder` não muda.
2. **`extract_travel_preferences(text) -> TravelPreferences` é agnóstico de
   provider, e `LLM_PROVIDER` já ramifica.** Adicionar `ollama` é um novo braço ao
   lado de `anthropic` e `mock`. A rota, a camada de busca e o contrato da API não
   mudam.

Tudo entre esses dois pontos — o schema, a busca, a UI, os testes — não é afetado
pela troca. Esse é o retorno de ter definido um contrato explícito em §2.2 e §2.3.

---

## 6. Modelo A — transcrição local com Whisper

### 6.1 Por que substituir a Web Speech API

Quatro razões, em ordem de quanto realmente pesam aqui:

**Privacidade é a de verdade.** A implementação de `SpeechRecognition` do Chrome
envia o áudio capturado para os servidores do Google para reconhecimento. A
afirmação da versão 1 de que "nenhum áudio toca o nosso backend" é verdadeira e
irrelevante — o áudio ainda sai do dispositivo. Whisper no browser é a única opção
deste documento em que o áudio genuinamente nunca deixa a máquina do usuário. Para
um produto de viagens isso é ameno; para qualquer coisa que toque saúde, finanças
ou jurídico é decisivo.

**Cobertura de browsers.** O Firefox não implementa a Web Speech API de forma
alguma; o suporte do Safari é parcial. Whisper compilado para WASM/WebGPU roda em
qualquer lugar onde o browser rode WebAssembly, o que é em todo lugar. Isso
transforma "funciona no Chrome e no Edge" em "funciona".

**Reprodutibilidade.** A Web Speech API é uma caixa-preta que pode mudar sob seus
pés sem versão, sem changelog e sem jeito de fixar comportamento. `whisper-base`
numa revisão específica é um artefato fixo. Se a qualidade da transcrição
regredir, dá para saber se foi a sua mudança.

**Precisão em PT-BR.** O treino multilíngue do Whisper lida visivelmente melhor
com nomes de lugares brasileiros e fala com sotaque do que o reconhecedor genérico
do browser — relevante quando o catálogo está cheio de palavras como _Maragogi_,
_Fernando de Noronha_ e _Chapada Diamantina_.

### 6.2 Qual Whisper, e quanto custa o download

O Whisper vem em tamanhos. A troca é peso de download e RAM contra precisão:

| Modelo                   | Parâmetros | Adequação prática ao browser                                            |
| ------------------------ | ---------: | ----------------------------------------------------------------------- |
| `whisper-tiny`           |        39M | O mais rápido, o mais fraco. Ok para comandos em inglês, fraco em PT-BR |
| `whisper-base`           |        74M | O padrão realista para este caso de uso                                 |
| `whisper-small`          |       244M | Nitidamente melhor com sotaque e nomes próprios                         |
| `whisper-medium`         |       769M | Raramente compensa num browser                                          |
| `whisper-large-v3-turbo` |       809M | Melhor qualidade ainda viável no browser, exige WebGPU                  |

Quantização (`q8`, `q4`) corta o download em várias vezes com perda modesta de
precisão. **Trate os tamanhos em bytes como questão em aberto, não como insumo de
planejamento** — verifique no model card ONNX específico antes de se comprometer,
porque variam por quantização e por encoder e decoder estarem quantizados igual ou
não. O formato da decisão é: dezenas de megabytes em `tiny`/`base`, centenas em
`small`, perto de um gigabyte em `large-v3-turbo`.

Qualquer que seja o número, **é um custo de primeira visita**, e precisa ser
cacheado (Cache API ou OPFS) ou todo carregamento de página rebaixa o modelo de
novo.

### 6.3 Como o Transformers.js roda isso na prática

`@huggingface/transformers` compila modelos ONNX para rodar no browser através do
ONNX Runtime Web, com backend WebGPU e fallback para WASM. A API é a mesma
abstração `pipeline` da biblioteca Python:

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

Duas coisas não são opcionais:

**Precisa rodar num Web Worker.** Inferência na main thread congela a UI durante
todo o decode — segundos, não milissegundos. O modelo carrega e roda num worker; o
hook conversa com ele por `postMessage`.

**WebGPU ou é lento demais.** O fallback WASM funciona e é limitado por CPU; num
notebook mediano pode rodar mais devagar que tempo real de `small` para cima. O
hook deve detectar `navigator.gpu`, escolher um modelo menor no caminho de
fallback, e dizer isso na UI em vez de parecer travado.

### 6.4 Streaming versus batch

A Web Speech API transmite resultados intermediários, que é por que a versão 1
mostra o texto aparecendo enquanto você fala. O Whisper é um modelo batch: ele
transcreve um trecho de áudio, não um stream ao vivo.

Duas opções:

- **Batch.** Grave com `MediaRecorder` até o usuário apertar parar, então
  transcreva uma vez. Simples, preciso (o modelo vê o contexto completo), mas a
  transcrição só aparece depois de uma pausa. Para este app — uma frase, depois uma
  busca — isso é perfeitamente aceitável e discutivelmente uma UX melhor do que
  assistir o texto se reescrever.
- **Pseudo-streaming em blocos.** Alimente janelas sobrepostas (ex.: 5s com 1s de
  sobreposição) e costure as saídas. Restaura o feedback ao vivo ao custo da
  lógica de costura, palavras duplicadas nas bordas e pior precisão por contexto
  truncado.

Para uma versão 2, batch primeiro. Blocos são complexidade real por ganho
cosmético.

### 6.5 No que o código se transforma

O novo hook mantém a interface existente, então nada acima dele muda:

```ts
// frontend/hooks/useWhisperTranscription.ts
export function useWhisperTranscription({ lang }: { lang: string }) {
  // Mesmo formato de retorno de useSpeechRecognition:
  // { isSupported, isListening, transcript, error, start, stop, reset, setTranscript }
}
```

Abaixo dele, o fluxo é:

```
getUserMedia()
   → MediaRecorder / AudioWorklet
   → decodificar para Float32Array, 16 kHz mono   ← formato exigido pelo Whisper
   → postMessage para o worker
   → pipeline do transformers.js
   → texto de volta para o hook
```

A etapa de resample é a que as pessoas esquecem: o Whisper espera `Float32Array`
mono a 16 kHz, e os browsers capturam a 44,1 ou 48 kHz. `AudioContext` com
`sampleRate` de 16000, ou `OfflineAudioContext` para reamostrar, resolve.

Uma flag `NEXT_PUBLIC_STT_ENGINE=webspeech|whisper` permite que os dois hooks
coexistam, que é como você faz A/B deles com fala real em vez de discutir sobre
eles.

### 6.6 Alternativas ao Whisper no browser

| Opção                                | Quando vence                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Transformers.js + WebGPU**         | Privacidade importa, usuários em browsers desktop modernos                                                |
| **whisper.cpp compilado para WASM**  | Você quer controle mais fino e runtime menor que o ONNX Runtime Web                                       |
| **faster-whisper no seu servidor**   | Clientes mobile ou fracos; uma GPU serve todos; o áudio sai do dispositivo mas fica na sua infraestrutura |
| **Uma API de transcrição hospedada** | Mais rápido de entregar, melhor precisão por esforço, mas é justamente do que estávamos tentando fugir    |

Note que um Whisper server-side _não_ é ganho de privacidade sobre a Web Speech
API — só muda qual empresa detém o áudio. Só o caminho no browser elimina a
transferência por completo.

### 6.7 Resumo dos trade-offs de transcrição

|                            | Web Speech API (v1)   | Whisper no browser       | Whisper no seu servidor |
| -------------------------- | --------------------- | ------------------------ | ----------------------- |
| Áudio sai do dispositivo   | Sim (Chrome → Google) | **Não**                  | Sim (→ seu servidor)    |
| Funciona em Firefox/Safari | Não / parcial         | **Sim**                  | Sim                     |
| Custo de primeiro load     | Nenhum                | Dezenas a centenas de MB | Nenhum                  |
| Latência                   | Ao vivo, streaming    | Segundos após parar      | Rede + inferência       |
| Offline                    | Não                   | **Sim**                  | Não                     |
| Custo de infraestrutura    | Nenhum                | **Nenhum**               | Host com GPU            |
| Reprodutível               | Não                   | **Sim**                  | **Sim**                 |
| Funciona em mobile fraco   | Sim                   | Mal                      | **Sim**                 |

---

## 7. Modelo B — extração local

### 7.1 A tarefa é pequena; o modelo não precisa ser grande

Vale dizer isso claramente, porque é o cerne de se a extração local é realista: o
trabalho é transformar uma frase em seis campos, dos quais quatro são enumerações
fechadas (seis categorias, doze meses, três níveis de orçamento) e dois são
valores simples (um nome de lugar, um número).

Isso não é trabalho de modelo de fronteira. É mais próximo de slot filling do que
de raciocínio. Um modelo instruct de 3B–7B bem instruído dá conta dos casos
comuns. A versão 1 usa um modelo de fronteira porque custa frações de centavo no
volume da PoC e remove uma variável — não porque a tarefa exija.

### 7.2 Constrained decoding é o truque inteiro

A razão de um modelo local pequeno ser viável é que a garantia do schema se
transfere. Deixado à geração livre, um modelo de 3B produz JSON malformado,
valores de enum inventados e cercas markdown com frequência suficiente para exigir
um loop de reparo.

Constrained decoding (decodificação restrita) elimina o modo de falha
completamente. `llama.cpp` (gramáticas GBNF), vLLM (`outlines` / `xgrammar`) e
Ollama suportam restringir a amostragem de tokens ao que a gramática permite. O
Ollama aceita um JSON Schema diretamente:

```python
response = client.chat(
    model="qwen2.5:7b-instruct",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": text},
    ],
    format=PREFERENCES_SCHEMA,   # o mesmo dict que já está em llm_service.py
)
return TravelPreferences.model_validate_json(response.message.content)
```

Leia com atenção: `PREFERENCES_SCHEMA` e `SYSTEM_PROMPT` são os **mesmos objetos
que a versão 1 já envia para a Anthropic**, e a linha de retorno é idêntica byte a
byte. A troca de provider é cerca de vinte linhas porque o contrato foi
explicitado em vez de deixado implícito num prompt.

Esta é a resposta concreta a "como você usaria um modelo local para fazer a
extração de dados": você não reestrutura nada. Adiciona um braço ao dispatch de
provider existente, aponta para um runtime local com schema restrito, e o resto do
sistema não consegue notar a diferença.

### 7.3 Opção 1 — Ollama numa máquina local ou VPS

**Formato.** O Ollama roda como serviço; o backend o chama por HTTP. Escolhas de
modelo na faixa útil: `qwen2.5:7b-instruct` (multilíngue forte, bom PT-BR),
`llama3.1:8b-instruct`, `phi-4-mini` (menor, mais voltado ao inglês).

**Ganhos.** Nenhum download por usuário. Um modelo serve todo request. Controle
total sobre a versão. Custo marginal por request é zero. Os dados nunca saem da
sua infraestrutura.

**Custos.** É um servidor que você agora opera. Em CPU, um modelo de 7B leva
segundos por request; você vai querer uma GPU. Isso é uma conta mensal real (ver
§9). E note o enquadramento honesto: isso é _self-hosted_, não _local para o
usuário_ — da perspectiva dele, a frase ainda viaja até um servidor.

### 7.4 Opção 2 — o modelo no browser (WebLLM)

**Formato.** O WebLLM (MLC) compila modelos instruct para WebGPU e os roda na aba.
Candidatos realistas são as classes instruct de 1.5B–3B em quantização de 4 bits.
Os tamanhos ficam na ordem de um a poucos gigabytes — novamente, **verifique no
model card**, e note que isso se soma ao download do Whisper de §6.2.

**Ganhos.** Zero infraestrutura e zero custo marginal, em qualquer escala.
Combinado com Whisper no browser, faz o pipeline de IA inteiro rodar no
dispositivo do usuário: nenhum áudio, nenhuma transcrição, nenhuma preferência sai
da máquina. Essa é uma afirmação genuinamente forte, e só está disponível por este
caminho.

**Custos.** Um primeiro load de múltiplos gigabytes é difícil de justificar num
site de viagens para consumidor. Pressão de RAM com dois modelos residentes.
Qualidade em 1.5B–3B é significativamente abaixo de 7B. WebGPU obrigatório.

**Onde encaixa.** Quiosques, ferramentas internas, apps offline-first, domínios
com regulação de privacidade — onde você controla o dispositivo ou o usuário tem
motivo para aceitar o download.

### 7.5 Opção 3 — um encoder fine-tunado em vez de um LLM

**Formato.** Trate como o que é — classificação de intenção mais slot filling — e
faça fine-tuning de um encoder pequeno (classe BERT/DeBERTa, ou uma variante
multilíngue para PT-BR) com uma cabeça de classificação por campo de enum e NER em
nível de token para destino e valor.

**Ganhos.** Ordens de magnitude menor e mais rápido que qualquer LLM aqui —
centenas de megabytes no máximo, milissegundos de um dígito em CPU, sem GPU. A
precisão nas enumerações fechadas pode _superar_ um LLM geral, porque o modelo é
treinado exatamente nesta distribuição.

**Custos.** Você precisa de dados rotulados — realisticamente alguns milhares de
frases anotadas. Adicionar um sétimo campo significa rerrotular e retreinar, onde
um LLM precisa de uma linha no prompt. Zero generalização para formulações fora da
distribuição de treino.

**Onde encaixa.** Quando o produto estabiliza, o schema para de mudar, e o volume
faz o custo ou a latência por request importarem. É o estado final certo para uma
versão madura desta feature, e a escolha errada para a versão 2.

### 7.6 Opção 4 — nenhum modelo

Regras, regex e um gazetteer (lista de nomes próprios). É o que
`LLM_PROVIDER=mock` já é, e vale nomear como opção real: para um catálogo fixo de
doze pacotes e seis categorias, algumas centenas de linhas de casamento por
palavra-chave cobrem uma fração surpreendente das frases reais.

Ele falha em tudo o que as regras do prompt da versão 1 existem para tratar —
contagem implícita ("com minha esposa e dois filhos"), datas relativas ("mês que
vem"), gíria ("uns 5 mil paus") e paráfrase ("algum lugar quente" → praia). Essa
lacuna é o valor real que o LLM adiciona, e medi-la contra a baseline de regras é
a forma mais limpa de justificar a existência do modelo.

### 7.7 O que você perde indo local, concretamente

As falhas não são aleatórias — elas se agrupam em inferências que exigem
conhecimento de mundo ou aritmética sobre a linguagem:

| Frase                                  | Modelo de fronteira                 | Modelo local 3B, provavelmente                 |
| -------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| "com minha esposa e dois filhos"       | `travelers: 4`                      | `travelers: 2` ou null                         |
| "algum lugar quente perto do Ano Novo" | `category: beach`, `month: January` | `month: January`, categoria null               |
| "no verão" (PT, hemisfério sul)        | `month: January`                    | null, ou um mês do verão do norte              |
| "uns 5 mil paus" (gíria)               | `max_budget: 5000`                  | null                                           |
| "não quero praia" (negação)            | categoria null                      | `category: beach` — **errado, não só ausente** |

Essa última linha é a de ficar de olho. Perder um campo degrada os resultados;
_inverter_ um produz recomendações confiantemente erradas. Tratamento de negação é
onde modelos pequenos falham de forma mais perigosa, e deveria ser um item
explícito em qualquer avaliação.

**Como decidir em vez de chutar.** Construa um conjunto de avaliação — 100 a 200
frases reais em PT e EN, rotuladas à mão com os seis campos corretos. Rode cada
candidato contra ele e reporte acurácia por campo, mais uma contagem separada de
inversões. Isso transforma "um modelo de 3B é bom o suficiente?" de opinião em
número, e é um dia de trabalho.

### 7.8 Resumo dos trade-offs de extração

|                                 | API Anthropic (v1)  | Ollama 7B self-hosted | WebLLM 3B no browser | Encoder fine-tunado    | Regras       |
| ------------------------------- | ------------------- | --------------------- | -------------------- | ---------------------- | ------------ |
| Qualidade da extração           | Máxima              | Alta                  | Moderada             | Alta _no domínio_      | Baixa        |
| Trata negação/gíria/implícito   | **Sim**             | Na maior parte        | Não confiável        | Só se treinado         | Não          |
| Schema garantido                | **Sim**             | **Sim** (gramática)   | Sim (gramática)      | N/A                    | N/A          |
| Latência                        | ~1–3 s              | ~0,5–2 s (GPU)        | 1–5 s                | **<50 ms**             | **<1 ms**    |
| Custo marginal                  | Por request         | Zero                  | **Zero**             | **Zero**               | **Zero**     |
| Custo fixo                      | Nenhum              | Host com GPU          | Nenhum               | Treino + rotulagem     | Nenhum       |
| Dados saem do dispositivo       | Sim                 | Para seu servidor     | **Não**              | Depende                | **Não**      |
| Esforço para adicionar um campo | Uma linha de prompt | Uma linha de prompt   | Uma linha de prompt  | Rerrotular + retreinar | Novas regras |

---

## 8. No que a arquitetura totalmente local se transforma

Com os dois modelos locais e no browser:

```
┌─────────────────────────── Browser ────────────────────────────┐
│  Microfone                                                     │
│      │                                                         │
│      ▼                                                         │
│  MediaRecorder → Float32Array 16 kHz mono                      │
│      │                                                         │
│      ▼   [Web Worker 1]                                        │
│  Whisper (Transformers.js, WebGPU)          ← Modelo A         │
│      │                                                         │
│      ▼   transcrição                                           │
│      │                                                         │
│      ▼   [Web Worker 2]                                        │
│  Qwen2.5-3B-Instruct (WebLLM, WebGPU)       ← Modelo B         │
│  + decodificação restrita por JSON Schema                      │
│      │                                                         │
│      ▼   TravelPreferences (JSON)                              │
└──────┼─────────────────────────────────────────────────────────┘
       │  POST /api/recommendations  { preferences }
       ▼
┌───────────────────────── FastAPI ──────────────────────────────┐
│  search_service.search_packages  →  SQLite  →  resultados       │
└─────────────────────────────────────────────────────────────────┘
```

Duas consequências que valem nota:

**O backend perde sua dependência de IA por completo.** Ele vira um serviço de
busca sobre SQLite. `llm_service.py` some do caminho da requisição; nenhuma API
key, nenhuma configuração de provider, nenhum braço de erro 502/503.

**Um novo endpoint é necessário.** O backend aceitaria `{ preferences }`
diretamente em vez de `{ text }`, porque a extração agora acontece no cliente.
Essa é uma mudança de API genuína — e o único ponto desta migração em que o
contrato da versão 1 não sobrevive intacto. Manter o endpoint `{ text }` ao lado
dele (extração server-side como fallback para dispositivos sem WebGPU) é
provavelmente o certo, o que significa que os dois caminhos coexistem em vez de um
substituir o outro.

**E um alerta que decorre disso:** uma vez que as preferências chegam do cliente,
elas são input controlado pelo usuário. A versão 1 as recebe de uma chamada
interna confiável; a versão 2 as receberia por HTTP. A validação do Pydantic já
restringe os enums, mas o endpoint precisaria do mesmo escrutínio de qualquer
input público — esta é uma consideração de segurança que a arquitetura atual não
tem.

---

## 9. Modelo de custo — o que você está de fato economizando

Custo por request da versão 1, usando o prompt real (923 caracteres ≈ 230 tokens)
mais o schema e uma frase curta:

- Entrada ≈ 500 tokens, saída ≈ 60 tokens
- **Claude Opus 5** (US$ 5/US$ 25 por MTok): (500 × 5 + 60 × 25) / 1.000.000 ≈ **US$ 0,004**
- **Claude Haiku 4.5** (US$ 1/US$ 5 por MTok): (500 × 1 + 60 × 5) / 1.000.000 ≈ **US$ 0,0008**

Note a sutileza do prompt caching: o prefixo estável aqui tem ~450 tokens, bem no
limite mínimo de 512 tokens para um prefixo cacheável no Opus 5. Provavelmente
_não_ cachearia sem inflar o system prompt — vale saber antes de assumir o
desconto.

Em volume:

| Requests / mês |    Opus 5 | Haiku 4.5 | GPU self-hosted | No browser |
| -------------: | --------: | --------: | --------------: | ---------: |
|          1.000 |     US$ 4 |  US$ 0,80 |        ~US$ 150 |      US$ 0 |
|         10.000 |    US$ 40 |     US$ 8 |        ~US$ 150 |      US$ 0 |
|        100.000 |   US$ 400 |    US$ 80 |        ~US$ 150 |      US$ 0 |
|      1.000.000 | US$ 4.000 |   US$ 800 |       ~US$ 150+ |      US$ 0 |

A conclusão não é a óbvia. **Hospedar a própria GPU para economizar custo de API é
um mau negócio até cerca de 190.000 requests por mês** (um host com GPU de
~US$ 150/mês contra Haiku a US$ 0,0008). Abaixo disso, a API é mais barata _e_
melhor _e_ não tem carga operacional.

Então custo é um mau argumento para ir local na escala de PoC. Privacidade,
capacidade offline, cobertura de browsers e reprodutibilidade são os bons
argumentos — e o browser é a única opção que entrega privacidade custando nada.

---

## 10. Plano de migração

**Fase 0 — Medir antes de mudar qualquer coisa.** Construa o conjunto de avaliação
de 100 a 200 frases de §7.7. Registre a acurácia por campo e a latência do
pipeline atual. Sem isso, toda comparação posterior é anedota.

**Fase 1 — Whisper atrás de uma flag.** Adicione `useWhisperTranscription`, atrele
a `NEXT_PUBLIC_STT_ENGINE`, rode os dois contra o mesmo áudio gravado. Esta é a
mudança de maior valor: corrige Firefox/Safari, remove a transferência de áudio
para o Google, e não toca o backend.

**Fase 2 — Extração local atrás de uma flag.** Adicione `LLM_PROVIDER=ollama` ao
lado de `anthropic` e `mock`, reaproveitando `PREFERENCES_SCHEMA` e
`SYSTEM_PROMPT` sem alteração. Rode contra o conjunto de avaliação. Decida pelos
números, especialmente pela contagem de inversões.

**Fase 3 — Só se totalmente offline for requisito.** Mova a extração para o
browser com WebLLM, adicione o endpoint `{ preferences }`, mantenha o endpoint
`{ text }` como fallback para dispositivos sem WebGPU, e trate o input do novo
endpoint como não confiável.

Cada fase é entregável e reversível de forma independente, e as fases 1 e 2 tocam
lados opostos do sistema.

---

## 11. Recomendação

**Faça a Fase 1. Seja cético quanto à Fase 2. Faça a Fase 3 só se alguém exigir.**

Whisper local é um ganho claro com custo limitado: remove a transferência de áudio
para um terceiro, dobra a cobertura de browsers, melhora nomes próprios em PT-BR e
torna a transcrição reprodutível. O preço é um download de primeiro load e um Web
Worker. Nada no backend muda.

Extração local é outra proposta. O modelo de fronteira se paga exatamente nos
casos que fazem o input de voz parecer inteligente — contagem implícita, negação,
gíria, inferência sazonal — e custa bem menos de um centavo por request.
Substituí-lo economiza quase nada em volume realista e arrisca o modo de falha que
mais importa, que é a inversão confiante em vez da omissão elegante.

A versão honesta da recomendação é que a _arquitetura_ deveria estar pronta para
extração local — e está, porque o braço de provider e o contrato de schema já
existem — enquanto o _padrão_ continua na API até que uma avaliação diga o
contrário, ou até que um requisito de privacidade ou offline tome a decisão por
você.
