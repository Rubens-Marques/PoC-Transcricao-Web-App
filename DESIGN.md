---
name: Brio
description: Paleta Sol — um único matiz amarelo, do papel ao quase-preto. Interface clean para 40+.
colors:
  papel: "#fffdf8"
  areia: "#faf5ea"
  creme: "#f4ecda"
  sol-100: "#fff6de"
  sol-200: "#ffe9b4"
  sol-300: "#ffd979"
  sol-400: "#ffc02e"
  sol-500: "#f0ab00"
  sol-600: "#b87c00"
  sol-700: "#9a6600"
  sol-800: "#6e4700"
  sol-900: "#4a2f00"
  tinta: "#241b09"
  tinta-suave: "#6a5836"
  linha: "#e7ddc8"
  linha-forte: "#8f7c52"
  alerta: "#8a2f00"
  alerta-fundo: "#fdefe7"
---

# Brio — Design System

Produto de viagem para pessoas de 40 anos ou mais. Duas decisões governam tudo o
que está aqui: **uma cor só** e **uma pergunta por vez**.

Fonte única de verdade: [`frontend/app/travely-tokens.css`](frontend/app/travely-tokens.css).
Os componentes CSS ficam em [`frontend/app/globals.css`](frontend/app/globals.css),
dentro de `@layer components`. Os componentes React vivem em
[`frontend/components/ui/`](frontend/components/ui/).

---

## 1. Uma cor só: a rampa Sol

Todo o produto usa um único matiz (amarelo/âmbar, hue ≈ 40), do papel ao
quase-preto. Não existe azul, verde nem cinza neutro na interface. O azul
sobrevive apenas **dentro dos arquivos SVG da marca**, que são assets — nenhum
token de produto aponta para ele.

Os neutros não são cinzas: `tinta` e `tinta-suave` são puxados para o mesmo
matiz, o que faz o preto do texto e o amarelo do botão parecerem da mesma
família em vez de duas decisões separadas.

### A regra que evita o desastre do amarelo

> **Amarelo claro é superfície. Amarelo escuro é tinta. Amarelo médio nunca é texto.**

`sol-400` sobre branco dá 1,6 : 1 — reprova em qualquer critério. Por isso
`sol-400` e `sol-500` só aparecem como **fundo**, sempre com texto `tinta` em
cima. Quando é preciso amarelo em cima de fundo claro (ícone, borda, texto de
apoio), o degrau usado é `sol-700` ou `sol-800`.

### Contraste medido

| Par                     | Razão    | Uso                                    |
| ----------------------- | -------- | -------------------------------------- |
| `tinta` / `papel`       | 16,7 : 1 | Texto principal                        |
| `tinta-suave` / `papel` | 6,8 : 1  | Texto secundário                       |
| `tinta` / `sol-400`     | 10,4 : 1 | Rótulo do botão primário               |
| `tinta` / `sol-100`     | 15,8 : 1 | Item selecionado, balão do assistente  |
| `linha-forte` / `papel` | 4,0 : 1  | Borda de campo (mínimo 3 : 1)          |
| `sol-700` / `sol-100`   | 4,6 : 1  | Borda de item selecionado              |
| `sol-800` / `papel`     | 8,1 : 1  | Anel de foco sobre fundo claro         |
| `sol-800` / `sol-400`   | 5,0 : 1  | Anel de foco **sobre o botão amarelo** |
| `alerta` / `papel`      | 8,3 : 1  | Erro                                   |

O anel de foco precisa ser escuro justamente porque metade das superfícies
clicáveis é amarela: um anel amarelo desapareceria nelas.

### Erro sem vermelho de semáforo

`alerta` é um terracota escuro (`#8a2f00`) — quente, portanto ainda dentro da
família, e escuro o bastante para passar contraste nos dois sentidos. "Feito"
não tem verde: é `sol-800` com ícone de check.

---

## 2. Acabamento: clean, não relevo

Bordas de **1px**, raio de 10px, sem sombra projetada, sem borda inferior
sólida, sem gradiente. O que sinaliza "isto é clicável" é o **tamanho do alvo**
e o **contraste do rótulo**, não a espessura da moldura.

Sombra só existe em um lugar (`--tv-sombra-leve`, `0 1px 2px` a 4% de opacidade)
e serve para separar o cartão do fundo, não para dar volume.

---

## 3. Escala, alvo e alinhamento

| Papel           | Token               | Tamanho                  |
| --------------- | ------------------- | ------------------------ |
| Título de tela  | `--tv-txt-titulo-g` | 32px                     |
| Título de seção | `--tv-txt-titulo`   | 26px                     |
| Corpo           | `--tv-txt-corpo`    | 20px                     |
| Apoio           | `--tv-txt-apoio`    | 18px — **piso absoluto** |
| Botão           | `--tv-txt-botao`    | 19px                     |

Altura de linha 1,6. **Alvo mínimo de 56px** (`--tv-alvo-min`), acima dos 44px
exigidos pela WCAG 2.2 — tremor e imprecisão de toque aumentam com a idade.

Tipografia: **Nunito** na marca e nos títulos, **Inter** no corpo. Inter separa
`I` maiúsculo de `l` minúsculo de `1`, o detalhe que decide se a pessoa digita
o email certo.

**Todo o conteúdo é centralizado** — texto, campos, botões e cartões, em todas
as telas.

---

## 4. Componentes

| Componente                 | Arquivo              | Nota                                                      |
| -------------------------- | -------------------- | --------------------------------------------------------- |
| `Button`                   | `ui/Button.tsx`      | Tons: `sol` (primário), `claro`, `nu`, `alerta`           |
| `TextField`                | `ui/TextField.tsx`   | Rótulo sempre visível; erro ligado por `aria-describedby` |
| `OptionList` / `MultiList` | `ui/OptionList.tsx`  | `radiogroup` e `checkbox` em cartões grandes              |
| `Check`                    | `ui/Check.tsx`       | Marca de seleção — o sinal que não depende de cor         |
| `Counter`                  | `ui/Counter.tsx`     | Dois botões grandes no lugar de `input[type=number]`      |
| `Callout`                  | `ui/Callout.tsx`     | Erro (triângulo) e aviso (círculo), com `role` correto    |
| `ProgressBar`              | `ui/ProgressBar.tsx` | Barra **mais** "Pergunta 3 de 7" por extenso              |

### Regras de estado

- **Selecionado** carrega três sinais somados: fundo `sol-100`, borda `sol-700`
  e a marca de seleção. Cor sozinha não diz nada.
- **Inativo** é superfície `areia` com texto `tinta-suave` — nunca opacidade,
  que derrubaria o contraste do rótulo junto com o do fundo.
- **Erro** é ícone + o que houve + o que fazer. Nunca só a cor da borda.
- A borda continua com 1px nos dois estados do item de opção, para que ele não
  "pule" de tamanho ao ser escolhido.

---

## 5. Os dois modelos de cadastro

O `/entrar` oferece **dois fluxos que coletam exatamente os mesmos sete campos**:

- **Passo a passo** (`WizardSignup`) — uma pergunta por tela, barra de progresso.
- **Conversando** (`ChatSignup`) — balões de mensagem, o assistente pergunta e a
  pessoa responde.

Isso é deliberado: os dois existem para serem comparados em teste com usuários
reais antes de escolher um. Por isso ambos usam a mesma casca (`EntrarShell`) —
topo, largura de leitura e posição da ação principal idênticos —, de modo que a
diferença medida seja o modelo de interação, e não a moldura.

Trocar de modelo zera o rascunho: carregar respostas de um para o outro
falsearia a comparação.

---

## 6. O que não fazer

1. **Amarelo médio (`sol-400`/`500`) como texto, ícone fino ou borda de 1px.**
   Existe só como fundo.
2. **Texto branco sobre amarelo.** Sobre qualquer amarelo o texto é `tinta`.
3. **Anel de foco claro.** O foco é sempre `sol-800`.
4. **Cor sozinha comunicando estado.** Sempre acompanhada de ícone, texto ou
   marca de seleção.
5. **Opacidade para apagar controle desativado.**
6. **Cores embutidas do Tailwind** (`blue-500`, `gray-700`…). Toda cor é um
   degrau da rampa Sol, exposto via `@theme inline`.
7. **Tela inteira de amarelo saturado.** O fundo é sempre `papel` ou `areia`.
8. **Texto abaixo de 18px.**
9. **Travar o zoom** (`maximum-scale`). É o recurso de acessibilidade mais usado
   por quem tem visão reduzida.
10. **Modo escuro.** Não existe versão invertida desta paleta.

---

## 7. Acessibilidade — o que já está no código

- `lang="pt-BR"`, link "Pular para o conteúdo" como primeiro tab de toda tela.
- Foco movido para a pergunta nova a cada passo do wizard, e para os resultados
  quando a busca responde — sem isso, quem usa teclado ou leitor de tela não
  fica sabendo que a tela mudou.
- Conversa marcada com `role="log"` e `aria-live="polite"`; cada balão diz
  "Você:" ou "Brio:" para leitor de tela, já que lado e cor não chegam nele.
- `prefers-reduced-motion` desliga as animações — inclusive a pausa de digitação
  do chat, que vai a zero.
- Mensagens de erro em português, dizendo o que fazer em seguida (o hook de voz
  devolvia `service-not-allowed` cru).
- Enums do backend (`beach`, `December`, `low`) traduzidos antes de chegar à
  tela.
