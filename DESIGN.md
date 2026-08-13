---
name: Travely
description: Paleta Manhã Clara — sol no horizonte, azul para avançar, amarelo para voz.
colors:
  papel: "#ffffff"
  areia: "#f5f2ec"
  tinta: "#1c1c1c"
  tinta-suave: "#4b4b4b"
  linha-forte: "#9a9285"
  linha-suave: "#e4e0d8"
  azul: "#0b5fbf"
  azul-sombra: "#084a96"
  azul-claro: "#e1edfc"
  amarelo: "#ffc02e"
  amarelo-sombra: "#d99e00"
  amarelo-claro: "#fff3d6"
  alerta: "#d32f2f"
  alerta-claro: "#fdeaea"
  feito: "#2e7d32"
  sobre-azul: "#ffffff"
typography:
  display:
    fontFamily: "Nunito, Trebuchet MS, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "Nunito, Trebuchet MS, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "1rem"
  lg: "1.5rem"
  full: "999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "1.5rem"
  "2xl": "2rem"
  "3xl": "2.5rem"
  control: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.azul}"
    textColor: "{colors.sobre-azul}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 1.75rem"
    height: "{spacing.control}"
  button-voice:
    backgroundColor: "{colors.amarelo}"
    textColor: "{colors.tinta}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 1.75rem"
    height: "{spacing.control}"
  button-ghost:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-chip-on:
    backgroundColor: "{colors.azul-claro}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
    height: "{spacing.control}"
  button-warn:
    backgroundColor: "{colors.alerta-claro}"
    textColor: "{colors.alerta}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  door-primary:
    backgroundColor: "{colors.azul}"
    textColor: "{colors.sobre-azul}"
    typography: "{typography.headline}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
    height: "7rem"
    width: "100%"
  door-voice:
    backgroundColor: "{colors.amarelo}"
    textColor: "{colors.tinta}"
    typography: "{typography.headline}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
    height: "7rem"
    width: "100%"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.85rem 1.1rem"
    height: "{spacing.control}"
    width: "100%"
  chat-bot:
    backgroundColor: "{colors.areia}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  chat-you:
    backgroundColor: "{colors.amarelo-claro}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
---

# Design System: Travely

## Overview

**Creative North Star: "Manhã Clara"**

Travely is a light morning window: white paper, a yellow sun over a blue horizon, and two obvious doors. The logo is that window. The UI borrows the same paints. Blue Horizonte advances (continuar, enviar, passo a passo). Yellow Manhã is the rare, warm action — voice, and on the first screen the Conversar door. Never a third action color. Never dark mode.

Type: Nunito 800 on screen titles, Inter 400/700 on body and buttons. Body is 20px. Buttons are 64px tall with a 4px solid lip, 16px corners, press-in. Selected items use Azul Claro + 3px blue border + a check — never color alone.

**Key Characteristics:**

- Paper `#FFFFFF` or sand `#F5F2EC`; ink `#1C1C1C`
- Blue confirms; yellow is voice / the other door (max one yellow control per screen)
- Green `#2E7D32` is status “feito” only — never a button
- Logo: sun, horizon, reflection. No globe, plane, pin, or backpack
- Portuguese, one question at a time

## Colors

Paleta do kit v1 (`frontend/app/travely-tokens.css`). Contrastes WCAG 2.1 já checados no manual.

### Primary

- **Azul Horizonte** (`azul` `#0B5FBF`): avançar, confirmar, enviar, porta Passo a passo. Texto branco.
- **Azul Sombra** (`azul-sombra` `#084A96`): lábio de 4px, pressionado, anel de foco.
- **Azul Claro** (`azul-claro` `#E1EDFC`): fundo de item selecionado, junto da borda azul e do ✓.

### Secondary

- **Amarelo Manhã** (`amarelo` `#FFC02E`): voz e, na primeira tela, Conversar. Texto tinta `#1C1C1C`. No máximo um por tela. Nunca como texto sobre branco.
- **Amarelo Sombra** (`amarelo-sombra` `#D99E00`): lábio do botão amarelo.
- **Amarelo Claro** (`amarelo-claro` `#FFF3D6`): balão de fala da pessoa, aviso ameno.

### Tertiary

- **Alerta** (`alerta` `#D32F2F`): erro. Fundo `alerta-claro`.
- **Feito** (`feito` `#2E7D32`): só status concluído.

### Neutral

- **Papel** (`papel`): canvas.
- **Areia** (`areia`): cartões, botão inativo, balão do sistema.
- **Tinta / Tinta Suave**: texto principal e secundário.
- **Linha Forte**: borda de campo. **Linha Suave**: separador decorativo — nunca borda de input.

### Named Rules

**Dois papéis.** Azul avança. Amarelo é voz (ou a outra porta na escolha). Não misturar no mesmo controle.

**Amarelo só como fundo.** Texto e ícone sobre amarelo são tinta escura. Amarelo sobre branco como texto é proibido.

**Seleção nunca é só cor.** Fundo azul claro + borda 3px + marca ✓.

Confirmed rejections: Duolingo green `#58CC02` as a button, neo-brutalist black offset, dark mode, yellow-to-blue gradient.

## Typography

**Display Font:** Nunito 800 (Trebuchet MS fallback)
**Body Font:** Inter 400 / 700 (Segoe UI, system-ui)
**Label/Mono Font:** none — labels use Inter

**Character:** Two faces only. Nunito holds the logo and screen titles. Inter holds reading and buttons. No serif, no condensed UI, no uppercase tracking as a style.

### Hierarchy

- **Display / Headline** (Nunito 800, 1.875rem / 30px): Screen question (“Como você quer começar?”, wizard prompts). One per screen.
- **Title** (Inter 700, 1.125–1.375rem): Default weight of `.btn` (22px on buttons).
- **Body** (Inter 400, 1.25rem / 20px, 1.5): Page default, chat, helpers. Floor for 60+.
- **Label** (Inter 400, 1.125rem / 18px): Smallest allowed size in the product (`--tv-txt-apoio`).

### Named Rules

**Two Faces.** Nunito 800 for titles. Inter 400/700 for everything else. Do not add Atkinson, a display serif, or a mono as the reading voice.

**The Big Type Floor Rule.** Body is 20px. Support copy never drops below 18px. Do not ship 12px / 14px captions.

## Layout

A single centered column on paper white. Choice uses a narrow board (`max-width: 36rem`); wizard, chat, and home widen (`max-width: 42–56rem`). Horizontal inset is 1.25rem.

First viewport: logo horizontal from the kit, one headline, two stacked full-width doors, then a muted helper. Wizard: header with symbol 48px, progress in azul, one question, primary action at the bottom. Chat: transcript grows; composer sticks to the bottom. Home: symbol + greeting, then voice search.

Touch floor is 64px on continue, send, option rows, and fields. Choice doors are 7rem.

### Named Rules

**The One Question Rule.** A lesson screen shows one prompt. Do not dump the profile into a multi-field login card.

## Elevation & Depth

Paper plus pressable keys. No drop shadows. Depth is a 4px solid lip (`box-shadow: 0 4px 0 <sombra>`). On press, `translateY(4px)` and the lip disappears. Focus is a 4px `azul-sombra` ring with 3px offset.

If `prefers-reduced-motion: reduce`, drop the 120ms transition; the press still may fire.

### Named Rules

**The Soft Lip Rule.** Depth is a 4px colored bottom edge. Never a 3px black offset, never a blur shadow, never a sharp neo-brutal slab.

## Shapes

Controls are 16px radius. Fields are 12px. Never a live corner, never a full pill on a button. Chat bubbles are 16px with the inner corner pulled in. Progress track is rounded 16px, fill azul.

### Named Rules

**The Sixteen Rule.** Interactive chrome is 16px radius. Do not sharpen to 0–4px, and do not balloon primary buttons into full pills.

## Components

### Buttons

16px radius, Inter 700, 22px type, 4px lip, 120ms press. Disabled is areia fill + tinta suave, no lip.

- **Primary (azul):** Avançar, continuar, criar conta, enviar, buscar. White type. Lip `azul-sombra`.
- **Voice (amarelo):** Falar, and on the first screen the Conversar door. Ink type. Lip `amarelo-sombra`. Max one yellow control per screen.
- **Ghost:** Paper fill, `linha-forte` lip, ink type. Voltar, limpar, unselected options.
- **Chip on:** `azul-claro` fill + 3px azul inset + ✓. Selected marital row, Sim/Não, hobby, language.
- **Hover / Focus:** No hover recolor. `:active` presses down. `:focus-visible` is the azul-sombra ring.
- **Warn:** `alerta-claro` wash, alerta type. Error / stop listening. Not a third action color.

### Chips

Hobby and option rows are full buttons, not tiny tags. Unselected = ghost. Selected = chip-on + check. Do not use color alone.

### Cards / Containers

Signup canvas is paper — no card chrome around the form. Home voice block and result cards sit on areia, no drop shadow.

### Inputs / Fields

- **Style:** Paper fill, 2px `linha-forte` stroke, 12px radius, 20px type, min height 64px.
- **Focus:** Stroke turns azul; the same 4px ring as buttons.
- **Error:** The field does not turn red. A warn banner appears below.

### Navigation

Header: ghost Voltar, 48px símbolo, muted note. Wizard progress is azul on areia. Logo on the first screen is the horizontal lockup from the kit. No hamburger, no icon-only back.

### Lesson Door

Two stacked full-width keys, 7rem min height. Azul = Passo a passo. Amarelo = Conversar. Equal weight.

### Chat Bubble

Two speakers, always labeled. Travely sits left: 48px símbolo + the word “Travely”, bubble on areia. The traveler sits right: 48px person silhouette on areia + “Você” (then first name after they say it), bubble on amarelo-claro. Composer repeats the traveler avatar beside the field so the person knows that box is their turn. Max ~40ch. No emoji, no unlabeled glyph.

## Do's and Don'ts

### Do:

- **Do** keep the canvas paper (`papel`) and body type at 20px Inter.
- **Do** use azul to continue and amarelo only for voice / the other door.
- **Do** give filled keys a 4px lip in the shadow sibling, and press with `translateY(4px)`.
- **Do** show one question per wizard step, with 64px-tall targets.
- **Do** mark selection with azul-claro + 3px azul border + ✓.

### Don't:

- **Don't** use Duolingo green `#58CC02` as a button, or a neo-brutalist 3px black offset.
- **Don't** center a login card or pack name/email/password into one slab.
- **Don't** add drop shadows, glass, dark mode, or a yellow-to-blue gradient.
- **Don't** ship captions below 18px.
- **Don't** put yellow type on white, or more than one yellow control per screen.
