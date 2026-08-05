# Deploy profile — PoC Transcrição Web App

> **NO AR** desde 2026-08-05 em <https://poc.nexusdatabi.com>

## Identity

- Repo: `PoC-Transcricao-Web-App` (github.com/Rubens-Marques)
- Stack: Next.js 16 + FastAPI + SQLite + Ollama (`qwen2.5:3b`)
- Edge: **Cloudflare Tunnel** — não usa o nginx do Elabore

## Host

`elabore-vps` (187.127.10.155), Ubuntu 24.04, Hostinger.
Diretório: `/home/deploy/poc-transcricao`, usuário `deploy` (uid **1001**).

| Recurso | Valor (após upgrade de 2026-08-05)    |
| ------- | ------------------------------------- |
| CPU     | 4 vCPU (AMD EPYC 9354P)               |
| RAM     | 15 GB · 4,1 GB em uso com a PoC no ar |
| Swap    | **0 B** — pendência, ver "Riscos"     |
| Disco   | 193 GB · 135 GB livres                |
| GPU     | nenhuma                               |

Coabita com a produção do Elabore (8 containers). **Nada do Elabore foi
alterado neste deploy** — nem nginx, nem portas, nem certificados.

## Edge — Cloudflare Tunnel

| Item       | Valor                                                     |
| ---------- | --------------------------------------------------------- |
| Tunnel     | `poc-vps`                                                 |
| UUID       | `2b194ee3-91de-4c13-8e34-f014153a45c8`                    |
| Credencial | `.infra/cloudflared/<uuid>.json` (chmod 600, fora do git) |
| DNS        | CNAME gerenciado pelo Cloudflare, proxied                 |

O `cloudflared` roda como container no profile `edge`, na mesma rede do compose.
As rotas apontam para **nomes de serviço** (`http://backend:8000`,
`http://frontend:3000`) — dentro de um container, `localhost` é o próprio
container.

Consequências: nenhuma porta aberta no host, nenhum certbot, o TLS vem do
Cloudflare (o que satisfaz o contexto seguro exigido pelo microfone), e o IP de
origem não fica exposto.

## Containers

| Nome                            | Imagem                 | Limites           | Papel     |
| ------------------------------- | ---------------------- | ----------------- | --------- |
| `poc-transcricao-ollama-1`      | ollama/ollama:0.12.6   | 2 CPU / 6 GB      | LLM local |
| `poc-transcricao-backend-1`     | build ./backend        | 0,5 CPU / 512 MB  | FastAPI   |
| `poc-transcricao-frontend-1`    | build ./frontend       | 0,5 CPU / 512 MB  | Next.js   |
| `poc-transcricao-cloudflared-1` | cloudflare/cloudflared | 0,25 CPU / 128 MB | Edge      |

Backend e frontend também publicam em `127.0.0.1:8001` e `127.0.0.1:3001`, para
curl local. Ollama não publica porta: não tem autenticação.

## Números medidos (2026-08-05)

| Métrica                            | Valor                         |
| ---------------------------------- | ----------------------------- |
| Latência morna, ponta a ponta      | **mediana 7,2s** (6,7–9,0s)   |
| Primeira request após restart      | **~64–70s** (carga do modelo) |
| RAM do Ollama com modelo residente | 2,16 GB                       |
| Acurácia da extração               | 5/5 nos casos testados        |

Ponta a ponta = navegador → Cloudflare → tunnel → FastAPI → Ollama → SQLite.
No Mac M-series com Metal a mesma extração leva 1,3s; a diferença é GPU.

`OLLAMA_KEEP_ALIVE=-1` mantém o modelo carregado (`ollama ps` mostra
`UNTIL: Forever`), então os 70s só voltam a acontecer se o container reiniciar.

## Comandos

```bash
ssh elabore-vps
cd /home/deploy/poc-transcricao
git pull --ff-only origin main
docker compose --profile edge up -d --build     # lê .env automaticamente
```

Saúde:

```bash
curl -s https://poc.nexusdatabi.com/health      # {"status":"ok","provider":"ollama"}
docker compose exec ollama ollama ps            # UNTIL deve ser "Forever"
docker compose logs cloudflared --tail 20
```

## Armadilhas encontradas neste deploy

Todas custaram um ciclo de debug. Estão registradas para não se repetirem.

1. **Variáveis inline não persistem.** Passar `LLM_MODEL=... docker compose up`
   funciona naquela subida, mas um `up` posterior de um único serviço recria os
   demais com os defaults do compose — foi assim que o modelo voltou de 3b para
   1.5b sozinho. **Use sempre o `.env`** (ver `.env.deploy.example`).
2. **`PUBLIC_API_URL` é só a origem, sem `/api`.** O `services/api.ts` já
   concatena `/api/recommendations`. Com `/api` no fim vira `/api/api/...` e 404. É baked no build do frontend, então corrigir exige `--build`.
3. **`cloudflared` precisa rodar como o dono da credencial.** A imagem tem um
   usuário não-root próprio que não lê um arquivo em chmod 600 de outro uid —
   entra em crash loop. `CLOUDFLARED_USER` no `.env` resolve sem afrouxar a
   permissão. Aqui o valor é `1001:1001`.
4. **`cloudflared tunnel route dns` ignora o nome do tunnel** se houver um
   `config.yml` com `tunnel:` no diretório — usa o do arquivo. Passar o UUID e
   `--config /dev/null` força o alvo certo.
5. **O WAF do Cloudflare bloqueia POST com User-Agent não-browser** (403). Só
   afeta scripts de teste, não o uso real. Use um UA de browser no curl.
6. **`sudo` está bloqueado por hook** neste ambiente — por isso o cloudflared é
   container em vez de pacote `.deb`.

## Riscos remanescentes

| Risco                             | Estado                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Sem swap                          | **Aberto.** Com 15 GB e 4,1 GB em uso a folga é grande, mas 4 GB de swapfile ainda seriam baratos                |
| Contenção de CPU com o Elabore    | Contido: Ollama limitado a 2 dos 4 vCPU. Durante inferência o Elabore ainda disputa                              |
| Latência de 7s para uma UX de voz | **Aberto.** Aceitável para demo, ruim para produto. Alternativas: `qwen2.5:1.5b` (mais rápido, erra mais) ou GPU |

## Volumes

| Volume                          | Conteúdo                       | Perda se apagado             |
| ------------------------------- | ------------------------------ | ---------------------------- |
| `poc-transcricao_ollama-models` | Pesos do `qwen2.5:3b` (2,4 GB) | Re-download no próximo start |

SQLite é populado no build da imagem — catálogo de demonstração, descartável.
