# Deploy profile — PoC Transcrição Web App

> ⚠️ **NÃO DEPLOYADO AINDA.** Este perfil descreve um deploy planejado, não um
> deploy existente. Ler a seção "Risco no alvo atual" antes de executar
> qualquer coisa.

## Identity

- Repo: `PoC-Transcricao-Web-App` (github.com/Rubens-Marques)
- Stack: Next.js 16 + FastAPI + SQLite + Ollama (`qwen2.5`)
- Edge: **indefinido** — a VPS candidata não tem proxy reverso livre

## Alvo candidato

- Host: `elabore-vps` (187.127.10.155), Ubuntu 24.04
- Compose: `docker-compose.yml` (raiz do repo)

### Recursos medidos em 2026-08-05

| Recurso | Valor                                  |
| ------- | -------------------------------------- |
| CPU     | 2 vCPU (AMD EPYC 9354P, compartilhado) |
| RAM     | 7,8 GB total · 5,9 GB disponível       |
| Swap    | **0 B**                                |
| Disco   | 96 GB · 38 GB livres                   |
| GPU     | nenhuma                                |

### Já rodando no host (produção Elabore)

`elabore-web` · `elabore-web-staging` · `elabore-api-rails-1` ·
`elabore-api-jobs-1` · `elabore-api-postgres-1` · `elabore-api-nginx-1` ·
`elabore-ia` · `elabore-ia-staging`

`elabore-api-nginx-1` é dono de **0.0.0.0:80 e 0.0.0.0:443**. Não há Traefik,
Dokploy nem nginx de host — o roteamento de qualquer novo serviço passa por
editar a configuração desse container de produção.

## Risco no alvo atual

Três fatores que se somam:

1. **2 vCPU, sem GPU.** Uma inferência satura os cores disponíveis. O compose
   limita o Ollama a 1,0 CPU justamente para deixar 1 vCPU ao Elabore — mas
   isso ainda reduz pela metade a CPU disponível para a produção durante cada
   request.
2. **Zero swap.** Se a RAM estourar, o OOM killer age sem rede de proteção e
   tende a escolher o processo mais gordo — provavelmente o Postgres do
   Elabore. Os limites de memória do compose (3 GB + 512 MB + 512 MB = 4 GB)
   cabem nos 5,9 GB disponíveis, mas a margem é apertada.
3. **HTTPS.** O microfone do browser exige contexto seguro. Só IP não serve —
   é preciso domínio e certificado, servidos pelo nginx de produção do Elabore.

**Recomendação: não subir neste host.** Ver alternativas abaixo.

## Modelo

| Ambiente                              | Modelo         | Latência medida |
| ------------------------------------- | -------------- | --------------- |
| Mac M-series (Metal)                  | `qwen2.5:3b`   | 1,3s mediana    |
| VPS 2 vCPU (estimado, **não medido**) | `qwen2.5:3b`   | 20s+            |
| VPS 2 vCPU (estimado, **não medido**) | `qwen2.5:1.5b` | 5–10s           |

O compose usa `qwen2.5:1.5b` por padrão via `LLM_MODEL`. Isso é uma concessão
ao hardware, não a escolha de qualidade — o 1.5b erra mais em negação e
contagem implícita. Nenhum dos números de VPS foi medido ainda.

## Comandos

```bash
# Da raiz do repo, no host alvo:
PUBLIC_ORIGIN=https://<dominio> \
PUBLIC_API_URL=https://<dominio>/api \
docker compose up -d --build

# Primeira subida baixa o modelo (ollama-pull). Acompanhar:
docker compose logs -f ollama-pull

# Saúde:
curl -s http://127.0.0.1:8001/health   # {"status":"ok","provider":"ollama"}
```

Portas ligadas apenas em `127.0.0.1` (8001 backend, 3001 frontend). O Ollama
**não publica porta** — não tem autenticação, e expor a 11434 entrega compute
para qualquer um que ache o IP.

## Alternativas ao alvo atual

1. **VPS separada** — 4 vCPU / 8 GB dedicada. Sem risco à produção, e permite
   voltar ao `qwen2.5:3b`.
2. **Túnel SSH** — só o Ollama na VPS, backend e frontend locais, alcançados
   por `ssh -L 11434:localhost:11434 elabore-vps`. Mede a latência real em CPU
   sem tocar em nginx nem expor porta.
3. **Adicionar swap ao host** — 4 GB de swapfile removem o risco de OOM, mas
   não resolvem a contenção de CPU nem o HTTPS.

## Volumes

| Volume          | Conteúdo                        | Perda se apagado             |
| --------------- | ------------------------------- | ---------------------------- |
| `ollama-models` | Pesos do modelo (~1 GB no 1.5b) | Re-download no próximo start |

O SQLite é populado no build da imagem (`RUN python -m database.seed`) — é
catálogo de demonstração, descartável, sem volume.
