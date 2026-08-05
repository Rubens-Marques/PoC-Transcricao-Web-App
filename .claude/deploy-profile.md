# Deploy profile — PoC Transcrição Web App

> ⚠️ **NÃO DEPLOYADO AINDA.** Este perfil descreve um deploy planejado. Ler
> "Pré-condições" antes de executar qualquer coisa.

## Identity

- Repo: `PoC-Transcricao-Web-App` (github.com/Rubens-Marques)
- Stack: Next.js 16 + FastAPI + SQLite + Ollama (`qwen2.5`)
- Edge: `elabore-api-nginx-1` (o mesmo que já serve a produção do Elabore)

## Alvo

- Host: `elabore-vps` (187.127.10.155), Ubuntu 24.04, Hostinger
- Compose: `docker-compose.yml` (raiz do repo)
- Domínio previsto: `poc.nexusdatabi.com` — **ainda não registrado**

### Recursos medidos em 2026-08-05 (ANTES do upgrade)

| Recurso | Antes                   | Depois do upgrade planejado |
| ------- | ----------------------- | --------------------------- |
| CPU     | 2 vCPU (AMD EPYC 9354P) | **a confirmar**             |
| RAM     | 7,8 GB · 5,9 GB livre   | 16 GB                       |
| Swap    | 0 B                     | 0 B (inalterado)            |
| Disco   | 96 GB · 38 GB livres    | a confirmar                 |
| GPU     | nenhuma                 | nenhuma                     |

**Re-medir depois do upgrade.** Se o plano da Hostinger que entrega 16 GB também
dobrar as vCPUs, esse é o ganho maior — CPU é o que dita a latência, não RAM.

### Já rodando no host (produção Elabore)

`elabore-web` · `elabore-web-staging` · `elabore-api-rails-1` ·
`elabore-api-jobs-1` · `elabore-api-postgres-1` · `elabore-api-nginx-1` ·
`elabore-ia` · `elabore-ia-staging`

## Edge / TLS — como o host já funciona

`elabore-api-nginx-1` é dono de `0.0.0.0:80` e `0.0.0.0:443` e serve quatro
subdomínios: `elaboreprovas`, `dev-rubens.elaboreprovas`, `elabore-api` e
`elabore-ia`, todos sob `nexusdatabi.com`.

| O quê        | Onde (host)                             | Montado no container     |
| ------------ | --------------------------------------- | ------------------------ |
| Configs      | `/home/deploy/elabore-api/.infra/nginx` | `/etc/nginx/conf.d` (ro) |
| Certificados | `/etc/letsencrypt`                      | `/etc/letsencrypt` (ro)  |
| Webroot ACME | `/var/www/certbot`                      | `/var/www/certbot` (ro)  |

Adicionar a PoC é o mesmo padrão repetido uma quinta vez. O template está em
`.infra/nginx/poc.conf.example` neste repo.

**Por que isso é menos arriscado do que parece:** `nginx -t` valida a config
antes do reload. Config errada → o teste falha, o reload não acontece, a
produção segue com a config antiga. Um server block novo para um `server_name`
novo não altera os quatro existentes.

## Pré-condições (nenhuma cumprida ainda)

1. [ ] Upgrade de RAM concluído e recursos re-medidos
2. [ ] Registro DNS A: `poc.nexusdatabi.com` → 187.127.10.155
3. [ ] Certificado emitido via certbot (webroot `/var/www/certbot`)
4. [ ] Swapfile de 4 GB — barato, e remove a última chance de OOM
5. [ ] Confirmação explícita do Rubens para mexer no host de produção

## Riscos remanescentes

| Risco                              | Status após o upgrade                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| OOM matando o Postgres             | **Muito reduzido** com 16 GB. Swapfile fecha de vez                          |
| Contenção de CPU com o Elabore     | **Depende** do vCPU pós-upgrade. Limites do compose contêm, mas não eliminam |
| Reload do nginx de produção        | **Baixo** — `nginx -t` valida antes                                          |
| HTTPS obrigatório para o microfone | **Resolvido** pelo caminho de certbot acima                                  |

## Modelo

| Ambiente             | Modelo         | Latência                         |
| -------------------- | -------------- | -------------------------------- |
| Mac M-series (Metal) | `qwen2.5:3b`   | 1,3s mediana — **medido**        |
| VPS 2 vCPU           | `qwen2.5:3b`   | 20s+ — **estimado, não medido**  |
| VPS 2 vCPU           | `qwen2.5:1.5b` | 5–10s — **estimado, não medido** |
| VPS 4 vCPU           | `qwen2.5:3b`   | 8–15s — **estimado, não medido** |

O compose usa `qwen2.5:1.5b` por padrão. Com 4 vCPU, subir para `3b`:

```bash
LLM_MODEL=qwen2.5:3b OLLAMA_CPUS=2.0 OLLAMA_MEM=6g docker compose up -d
```

Nenhum número de VPS foi medido. A forma mais barata de medir sem tocar em
produção é o túnel SSH descrito abaixo.

## Comandos

```bash
# No host alvo, da raiz do repo:
PUBLIC_ORIGIN=https://poc.nexusdatabi.com \
PUBLIC_API_URL=https://poc.nexusdatabi.com/api \
docker compose up -d --build

# Primeira subida baixa o modelo:
docker compose logs -f ollama-pull

# Saúde:
curl -s http://127.0.0.1:8001/health   # {"status":"ok","provider":"ollama"}
```

Portas ligadas apenas em `127.0.0.1` (8001 backend, 3001 frontend). O Ollama
**não publica porta** — não tem autenticação, e expor a 11434 entrega compute
para qualquer um que ache o IP.

## Medir latência sem tocar em produção

```bash
ssh -L 11434:localhost:11434 elabore-vps   # túnel, sem porta aberta
# noutro terminal, backend local apontando para a VPS:
LLM_PROVIDER=ollama OLLAMA_HOST=http://localhost:11434 uvicorn main:app
```

Responde "quanto custa isso em CPU nesta máquina?" em minutos, sem nginx, sem
container novo, sem risco ao Elabore.

## Volumes

| Volume          | Conteúdo                                     | Perda se apagado             |
| --------------- | -------------------------------------------- | ---------------------------- |
| `ollama-models` | Pesos do modelo (~1 GB no 1.5b, ~2 GB no 3b) | Re-download no próximo start |

O SQLite é populado no build da imagem (`RUN python -m database.seed`) — é
catálogo de demonstração, descartável, sem volume.
