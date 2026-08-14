# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 no frontend existente. Backend FastAPI + LLM (Ollama local ou API na VPS) já na PoC de voz. Nativo (iOS/Android) fica explicitamente para depois; esta PoC é web.

## Users

Público primário: pessoas mais velhas que já criaram os filhos, já viveram bastante, e agora querem viajar. Não são nativas digitais. Precisam de um aplicativo extremamente simples, intuitivo, com leitura fácil e sem fricção de “rede social”.

O fundador identificou esse grupo como o maior público real da necessidade — viajantes experientes, não o público jovem de apps de viagem atuais.

## Product Purpose

Comunidade de viagem para pessoas mais velhas: receber e compartilhar dicas (com fotos e vídeos curtos) sem a burocracia de montar um perfil social.

A busca por voz continua sendo recurso primordial: a pessoa fala o que quer; o sistema entende e ajuda.

Sucesso nesta PoC: a pessoa consegue criar a conta sozinha, entende o que está acontecendo, e percebe que pode participar da comunidade sem cadastro pesado.

## Positioning

Não é mais um feed de viagem para jovens. É uma comunidade desenhada para quem tem mais idade: entrada guiada, linguagem clara, voz como caminho principal, e compartilhar dica sem virar influenciador.

Nesta PoC de entrada, o cadastro existe em dois modelos lado a lado, para o fundador mostrar como a mesma conta pode nascer:

1. Wizard: um passo de cada vez, com os dados pedidos.
2. Chatbot: o sistema pergunta, a pessoa responde em linguagem natural, a IA da VPS interpreta / corrige / confirma, e só então cria a conta.

## Operating Context

PoC neste repositório. A cadeia atual (voz no browser → LLM → preferências → busca no catálogo) permanece como recurso de busca.

A IA já usada na VPS entra no modelo conversacional de cadastro: entender a resposta, identificar o dado, corrigir se estiver incompleto ou ambíguo, e seguir a conversa até ter o suficiente para criar a conta.

Localização (cidade, estado, país) pode ser sugerida a partir do acesso, nunca exigida como digitação cega.

## Capabilities and Constraints

Dados necessários para começar a conta:

- Nome
- Email
- Data de nascimento
- Cidade, estado e país onde mora (sugerir pela localização de acesso)
- Estado civil
- Se tem filhos menores e quantos
- Hobbies (o que gosta de fazer)

Restrições confirmadas:

- Cadastro nesta PoC é wizard (um passo de cada vez) **e** um segundo modelo conversacional; os dois coletam os mesmos dados.
- Compartilhar dicas (fotos e vídeos curtos) não deve exigir um perfil social rico; o cadastro existe para conhecer a pessoa, não para ela “se apresentar” como em rede social.
- Tema claro, tipografia grande, leitura em primeiro lugar.
- Nome do produto: **Brio**.
- Wordmark em curvas (Nunito). Nome: Brio; o símbolo (sol, horizonte e reflexo) não depende do nome.

Fora desta PoC de entrada: app nativo, pagamentos, reserva.

## Brand Commitments

Kit de marca v1 **Manhã Clara** (arquivos em `frontend/public/brand/`):

- Símbolo: sol, horizonte e reflexo, em campo azul. Sem globo, avião, mala ou pin.
- Wordmark em curvas (Nunito). Nome: **Brio**. O símbolo não depende do nome.
- Paleta: Papel `#FFFFFF`, Tinta `#1C1C1C`, Azul Horizonte `#0B5FBF` (avançar), Amarelo Manhã `#FFC02E` (voz; no máximo um por tela), Alerta `#D32F2F`. Verde `#2E7D32` só para status “feito”, nunca botão.
- Tema claro único. Sem dark mode. Sem degradê amarelo–azul.
- Tipo: Nunito 800 nos títulos; Inter 400/700 no corpo e botões. Corpo mínimo 20px. Alvo de toque 64px.
- Manual: `frontend/public/brand/MANUAL-DE-MARCA.md` e tokens `frontend/app/travely-tokens.css`.

## Evidence on Hand

Logo, símbolo, wordmark, ícone 1024, favicon e tokens no kit acima. Sem depoimentos nem fotos de clientes — não fabricar prova social.

## Product Principles

1. Um passo de cada vez: a pessoa nunca enfrenta um formulário de “rede social”.
2. Acessibilidade não é extra: tipo grande, tema claro, contraste, alvos de toque generosos, copy em português simples.
3. Sugerir em vez de exigir: localização e correções da IA vêm como ajuda, não como obstáculo.
4. Voz é caminho de primeira classe, não atalho escondido.
5. Compartilhar dica é o ato; o perfil é o mínimo para a comunidade fazer sentido.

## Accessibility & Inclusion

Desenhado para pessoas idosas: tema claro, fontes grandes, contraste alto, linguagem direta, apoio de leitura. Alvos de toque grandes. Sem depender de gestos sutis, ícones sem rótulo, ou dark mode como padrão. Formulários e o chatbot devem ser usáveis com leitores de tela e com baixa visão.
