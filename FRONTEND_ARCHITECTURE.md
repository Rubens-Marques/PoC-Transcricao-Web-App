# Frontend architecture — Travely (PoC)

PoC web em `frontend/`. Next.js 16 App Router, React 19, Tailwind v4. Sem BaaS. Sem biblioteca de UI extra: Context7 (`/vercel/next.js`) confirma que interatividade (estado, `localStorage`, geolocation) fica em Client Components; a página `/signup` permanece Server Component e só monta o client.

## Estrutura

```
frontend/
  app/                 rotas + tokens + layout
  components/          UI
    signup/            cadastro (escolha, wizard, conversa)
  lib/                 domínio de perfil e parse do chat
  hooks/               Web Speech
  services/            HTTP da busca
  types/               contratos da API
```

Separação atual:

| Camada        | Onde                                   | Papel                                |
| ------------- | -------------------------------------- | ------------------------------------ |
| Domínio       | `lib/profile.ts`, `lib/signup-chat.ts` | perfil, validação, parse da conversa |
| UI de entrada | `components/signup/*`                  | escolha, wizard, chat com avatares   |
| Busca         | `VoiceRecorder`, `services/api.ts`     | voz → API                            |

`SignupApp` só escolhe o caminho. Wizard em `WizardSignup`, conversa em `ChatSignup`.

## Código

- **Antes:** um único `EntrarApp` (~728 linhas) misturava escolha, wizard, chat, geolocation e parse.
- **Agora:** `SignupApp` só escolhe o caminho. Wizard em `WizardSignup`, conversa em `ChatSignup`, parse em `lib/signup-chat.ts`, perfil validado em `lib/profile.ts`. Localização: browser pede GPS, o FastAPI (`POST /api/place`) fala com o Nominatim.
- **Estado:** perfil no React + `localStorage`. Sem store. Adequado.
- **Acoplamento:** Chat ainda é heurística local — a IA da VPS não está plugada, de propósito.

Não recomendar Lucide/Heroicons/shadcn: um SVG próprio cobre o ícone de usuário e obedece o kit (sem emoji, sem ícone sem palavra).

## Performance

- Bundle mínimo (Next + React + Tailwind). Sem lazy extra: `/signup` e `/` são o produto.
- `ChatSignup` só monta no modo conversa.
- Sem memoização ainda — listas curtas (≤ ~15 turnos).
- Imagens de marca são SVG/PNG pequenos em `/public/brand`.

## Segurança

| Risco                      | Estado                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Perfil em `localStorage`   | `parseStoredProfile` rejeita JSON inválido; home trata como deslogado.                                        |
| Coordenadas                | Browser só pede GPS. `POST /api/place` arredonda (~100 m), User-Agent do OSM, timeout 8s, sem log de lat/lon. |
| Cadastro sem senha/sessão  | PoC. Não tratar como auth.                                                                                    |
| `NEXT_PUBLIC_API_BASE_URL` | origem pública; o browser chama a API direto. CORS no backend.                                                |

## Impeccable audit

Alvo: `frontend/components/signup/*` e a superfície `/signup`.

### Audit Health Score

| #         | Dimension                | Score     | Key finding                                                                                                                                  |
| --------- | ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Accessibility            | 3         | Conversa agora tem falante visível (ícone + “Travely” / “Você”). Wizard passo 4 ainda empilha labels de 30px.                                |
| 2         | Performance              | 3         | Bundle enxuto. Wizard ainda no mesmo client tree.                                                                                            |
| 3         | Responsive Design        | 3         | Alvos 64px. Header de 3 células aperta “Pergunta n de 7” no mobile estreito. Composer do chat (avatar + campo + Enviar) fica justo em 320px. |
| 4         | Theming                  | 3         | Tokens Manhã Clara. Sidecar `.impeccable/design.json` ainda descreve verde Duolingo.                                                         |
| 5         | Implementation Integrity | 3         | Kit aplicado. Brief da superfície ainda cita Atkinson, vermelho/amarelo e neo-brutalismo.                                                    |
| **Total** |                          | **15/20** | **Good**                                                                                                                                     |

### Implementation Integrity Verdict

**Pass.** A implementação expressa Manhã Clara (papel, azul para avançar, amarelo só na porta Conversar / voz, Nunito + Inter, lábio 4px). O detector e o brief persistido podem mentir sobre o mundo antigo — o código não.

### Executive summary

- Score: **15/20** (Good)
- P0: nenhum
- P1: Nominatim no client; `loadProfile` sem validar; brief/sidecar defasados
- P2: wizard monolítico; erros da API em inglês na home; sem testes no frontend
- P3: `design.json` stale

### Findings

- **[P1] Reverse geocode no browser** — `EntrarApp.fillLocation`. Categoria: Segurança / a11y de confiança. Impacto: localização vai para OSM. Recomendação: endpoint no FastAPI. Comando: `/impeccable harden`.
- **[P1] Perfil sem parse seguro** — `lib/profile.ts`. Impacto: storage corrompido quebra a home. Recomendação: validar campos antes de aceitar. Comando: `/impeccable harden`.
- **[P2] Wizard ainda no `EntrarApp`** — manutenção. Comando: `/impeccable distill`.
- **[P2] Brief da superfície desatualizado** — `.impeccable/surfaces/frontend-app-entrar-page-tsx.md` ainda fala Atkinson e botão vermelho. Comando: `/impeccable document`.
- **[P2] Composer do chat em 320px** — avatar + campo + Enviar. Categoria: Responsive. Comando: `/impeccable adapt`.
- **[P3] Sidecar `design.json`** — contradiz `DESIGN.md`. Comando: `/impeccable document`.

### Patterns

- Um Client Component por fluxo (escolha / wizard / chat), domínio em `lib/`.
- Ícone sempre com palavra ao lado. Sem emoji de “pessoa”.
- Tokens `--tv-*` e classes `.btn` / `.field`; não espalhar hex.

### Positive

- Duas portas, uma pergunta por vez, contraste do kit, copy em português, chat com `aria-live` e rótulos de falante.

### Recommended actions

1. **[P1] `/impeccable harden`**: validar `loadProfile`; tirar Nominatim do browser.
2. **[P2] `/impeccable distill`**: extrair `WizardSignup`.
3. **[P2] `/impeccable adapt`**: composer do chat em viewport estreito.
4. **[P3] `/impeccable document`**: regenerar sidecar e atualizar o surface brief.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
