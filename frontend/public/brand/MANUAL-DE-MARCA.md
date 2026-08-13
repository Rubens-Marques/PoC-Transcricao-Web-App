# Travely — Manual de marca v1

> Nome de trabalho provisório. O símbolo não contém letra nenhuma, então uma troca de nome afeta só o wordmark.
> Paleta: **Manhã Clara** (amarelo, azul, branco). Tema claro único, sem modo escuro.

---

## 1. Conceito do símbolo

Um sol acima da linha do horizonte e o seu reflexo logo abaixo, dentro de uma janela de canto arredondado.

O sol é a hora em que essas pessoas de fato abrem o aplicativo — de manhã, com luz e sem pressa — e o horizonte é o lugar que ainda vai ser visitado, não um destino já fechado. O reflexo é a parte que fala de companhia: no símbolo o sol aparece sempre em dupla, porque aqui a dica de um só vira viagem quando alguém do outro lado responde.

**O que ele evita de propósito:** globo, avião, mala, alfinete de mapa, mochila, palmeira. Nenhum deles fala de companhia — e companhia é o que este produto vende.

**Por que aguenta 24 px:** três formas cheias (um círculo e duas barras) dentro de um campo de cor. Não existe traço fino para perder, então não há versão simplificada para manter.

---

## 2. Arquivos

| Arquivo | Para quê |
|---|---|
| `travely-logo-horizontal.svg` | Uso padrão. Símbolo + nome, fundo claro. Texto já em curvas. |
| `travely-simbolo.svg` | Símbolo isolado, colorido. |
| `travely-wordmark.svg` | Só o nome, em curvas. |
| `travely-logo-mono-preto.svg` | Uma cor só, para fundo claro. |
| `travely-logo-mono-branco.svg` | Uma cor só, para fundo escuro **sólido**. Nunca sobre foto. |
| `travely-simbolo-mono-preto.svg` / `-branco.svg` | Símbolo vazado, uma cor só. |
| `travely-app-icon-1024.svg` | Ícone, quadrado cheio, sem canto arredondado próprio. |
| `travely-icone-1024/512/180/120/64/32.png` | Exportações prontas para lojas e web. |
| `travely-favicon.svg` | Favicon. |
| `travely-tokens.css` | Variáveis de cor, tipo, forma e componentes base. |
| `travely-brand-kit.html` | Kit visual completo — abra no navegador. |

O wordmark está **em curvas** em todos os SVGs. Nenhum arquivo depende de a Nunito estar instalada na máquina de quem abrir.

---

## 3. Paleta Manhã Clara

| Token | Nome | Hex | Uso | Contraste |
|---|---|---|---|---|
| `--tv-papel` | Papel | `#FFFFFF` | Fundo padrão de tela | base |
| `--tv-areia` | Areia | `#F5F2EC` | Cartões, blocos agrupados | base |
| `--tv-tinta` | Tinta | `#1C1C1C` | **Texto principal** e todo texto sobre amarelo | 16,9 : 1 no branco |
| `--tv-tinta-suave` | Tinta Suave | `#4B4B4B` | Texto secundário. Cinza mais claro do produto | 8,7 : 1 no branco |
| `--tv-azul` | Azul Horizonte | `#0B5FBF` | **Primária.** Avançar, confirmar, enviar, links | 6,2 : 1 com texto branco |
| `--tv-azul-sombra` | Azul Sombra | `#084A96` | Borda inferior 4 px, pressionado, anel de foco | 8,6 : 1 |
| `--tv-azul-claro` | Azul Claro | `#E1EDFC` | Fundo de item selecionado | 14,4 : 1 com Tinta |
| `--tv-amarelo` | Amarelo Manhã | `#FFC02E` | **Secundária.** Botão de voz e cor de marca | 10,4 : 1 com Tinta |
| `--tv-amarelo-sombra` | Amarelo Sombra | `#D99E00` | Borda inferior 4 px e pressionado | 7,2 : 1 com Tinta |
| `--tv-amarelo-claro` | Amarelo Claro | `#FFF3D6` | Aviso ameno, marcação de texto | 15,4 : 1 com Tinta |
| `--tv-alerta` | Vermelho Aviso | `#D32F2F` | **Alerta.** Erro e ação destrutiva | 5,0 : 1 nos dois sentidos |
| `--tv-feito` | Verde Confirmado | `#2E7D32` | Só status "feito". Nunca vira botão | 5,1 : 1 no branco |
| `--tv-linha-forte` | Linha Forte | `#9A9285` | Borda de campo e de cartão clicável | 3,1 : 1 no branco |
| `--tv-linha-suave` | Linha Suave | `#E4E0D8` | Separador **só decorativo** | 1,5 : 1 — não carrega significado |

### Por que amarelo e azul, e não amarelo e verde

Decisão técnica antes de estética. Amarelo e azul continuam distinguíveis em daltonismo vermelho-verde, que atinge cerca de 8% dos homens. Além disso, os dois diferem muito em **claridade**, não só em matiz — em preto e branco, um fica claro e o outro escuro. Isso significa que a diferença sobrevive a visão reduzida, tela ruim e luz forte, não só a daltonismo.

### O verde saiu da paleta de ação

O `#58CC02` do rascunho anterior foi tirado dos botões. Sobrou um único verde, `#2E7D32`, e só para dizer "feito" em texto ou ícone de status. Com amarelo e azul mandando na marca, um terceiro verde saturado quebra a hierarquia e reintroduz o par verde/vermelho, que é o pior possível para daltonismo.

### Divisão de papéis entre as duas cores de ação

| | Azul Horizonte | Amarelo Manhã |
|---|---|---|
| Papel | Avançar, confirmar, enviar | Falar / buscar por voz |
| Texto em cima | Branco `#FFFFFF` | Tinta `#1C1C1C` |
| Quantidade por tela | Sem limite | **No máximo um** |

O botão de voz é a função-assinatura do produto. Dar a ele a cor mais quente e mais rara da paleta faz com que ele seja achado sem legenda.

---

## 4. O que **não** fazer com essas cores

**Reprova em contraste — não é gosto:**

1. **Amarelo como texto ou ícone sobre branco.** Dá 1,6 : 1. O amarelo existe só como *fundo*.
2. **Texto branco sobre amarelo.** Dá 1,6 : 1. Sobre amarelo o texto é sempre `#1C1C1C`.
3. **Linha Suave `#E4E0D8` como borda de campo.** Dá 1,5 : 1. Borda que precisa ser vista usa Linha Forte `#9A9285`.

**Quebra a compreensão:**

4. **Cor sozinha dizendo o que aconteceu.** Erro precisa de ícone + o que houve + o que fazer: "⚠ Sua foto não foi enviada. Toque em Tentar de novo."
5. **Seleção marcada só por cor de fundo.** Item selecionado leva fundo Azul Claro **+** borda azul de 3 px **+** marca de seleção.
6. **Opacidade para "apagar" botão desligado.** Botão inativo usa fundo Areia com texto Tinta Suave, mantendo contraste legível.

**Quebra a marca:**

7. **Degradê de amarelo para azul.** O meio vira um verde sujo e nenhuma tinta fica legível nele. As duas cores só se encontram lado a lado, com limite duro.
8. **Tela inteira de amarelo.** Na luz da manhã, um campo grande de amarelo saturado ofusca. Fundo é sempre Papel ou Areia.
9. **Modo escuro.** Não existe versão invertida desta paleta.
10. **Texto sobre foto.** Legenda vai abaixo da imagem, em Papel ou Areia.

---

## 5. Tipografia

| Papel | Fonte | Tamanho |
|---|---|---|
| Marca e títulos de tela | **Nunito** 800 | 30 px no título |
| Botão | **Inter** 700 | 22 px |
| Corpo | **Inter** 400 | 20 px |
| Apoio | **Inter** 400 | 18 px — piso absoluto do produto |

Nunito no nome: terminações arredondadas, olho grande, simpatia sem virar fonte de festa infantil. Inter no corpo: separa bem **I** maiúsculo de **l** minúsculo de **1**, detalhe que decide se a pessoa digita o código certo. As duas são Google Fonts, licença SIL OFL, uso comercial liberado.

Altura de linha 1,5. Nada de texto justificado — alinhamento à esquerda.

---

## 6. Regras de aplicação

**Folga em volta da logo:** igual à largura do reflexo (≈ 42% da largura do símbolo). Nada entra nesse espaço.

**Tamanho mínimo do símbolo:** 24 px. Abaixo disso, use o campo azul liso sem o desenho.

**Ícone de app:**
- Nunca escrever "Travely" dentro. O sistema já mostra o nome embaixo.
- Exportar o quadrado cheio, sem canto arredondado próprio — Android e iOS aplicam a máscara.
- O sol fica no eixo central, para sobreviver à máscara circular do Android.
- Sem sombra, sem brilho, sem borda.
- Sol amarelo sobre azul dá 3,8 : 1 — passa o mínimo de 3 : 1 que a WCAG pede para elemento gráfico.

**Fundo azul no ícone é exceção consciente** à regra de fundo claro. O ícone é a única superfície que não controlamos: ele cai sobre um papel de parede qualquer. Em branco, sumiria.

**Alvo de toque:** 64 px de altura mínima em qualquer botão. A WCAG pede 44 px; para 60+ com tremor ou dedo grande, 44 é pouco.

---

## 7. Tom da copy

Português simples, verbo na frente, dizendo exatamente o que o botão faz.

**Assim sim:** "Como você quer começar?" · "Ver dicas de viagem" · "Sua foto foi enviada." · "Não deu certo. Toque em Tentar de novo."

**Nunca:** "Unlock your next adventure" · "Explorar" · "Ops! Algo deu errado 😅" · "Sua jornada começa aqui"

Regras fixas:
- O nome da ação não muda no meio do caminho. O botão "Enviar foto" gera a mensagem "Foto enviada".
- O erro não pede desculpa nem faz graça. Diz o que houve e qual é a saída.
- Tela vazia é convite, não lamento: "Nenhuma dica ainda. Toque em Escrever dica."
- Nada de vocabulário de sistema. A pessoa gerencia *avisos*, não *notificações push*.

---

## 8. Riscos em aberto — checar antes de fechar a v1

| Risco | Grau | O que fazer |
|---|---|---|
| Nome "Travely" pode estar registrado ou em uso | **Alto** | Busca no INPI (classes 39 e 42) + registro.br + lojas de app. Não fiz essa pesquisa. |
| "Sol sobre o horizonte" é um recurso visual comum | Médio | O que torna o desenho ownável é o reflexo em barra e a proporção do campo azul. Vale checar concorrentes diretos antes de registrar. |
| Amarelo `#FFC02E` puxa para "aviso/atenção" em alguns contextos | Médio | Testar com 5 usuários reais: mostrar a tela e perguntar qual botão eles apertariam primeiro. |
| Contrastes foram calculados, não medidos em tela real | Baixo | Rodar Lighthouse ou axe DevTools na UI construída. Tela de tablet em luz forte muda a percepção. |

**Próximo passo que eu recomendo:** antes de codar qualquer tela, testar a tela de abertura impressa em papel A4 com 3 a 5 pessoas do público real. A pergunta é uma só: *"o que você faria nessa tela?"*. Se a pessoa hesitar entre os dois botões, o problema é de copy ou de cor, e sai muito mais barato descobrir agora.

---

*Travely — kit de marca v1 · paleta Manhã Clara · nome de trabalho provisório*
