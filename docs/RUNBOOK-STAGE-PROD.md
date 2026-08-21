# Runbook Stage -> Prod (FortCordis)

Este runbook descreve o processo seguro para promover codigo de `stage` para `prod` com downtime minimo.

## Acesso à VPS (produção / main)

- **Prod (main):** `ssh martiniano@216.238.116.77`
- Diretório prod: `/var/www/fortcordis-v2`
- Stage (se na mesma VPS): `/var/www/fortcordis-stage`

## Fluxo de entrega (stage-first)

Regra: **nenhuma feature entra direto em produção**. `main` so recebe o que ja
rodou em stage.

1. Feature/fix sai de `stage` e abre PR com base `stage`.
2. Merge em `stage` -> deploy automatico de stage (`.github/workflows/deploy-stage.yml`).
3. Teste em stage (ver secao de smoke/preflight abaixo).
4. Promocao para produção, por um dos dois caminhos:
   - PR de release `stage -> main` (titulo `chore(release): promover <resumo>`), ou
   - `bash scripts/promote_stage_to_main.sh` (worktree isolado, merge `--no-ff`).
5. Merge/push em `main` -> deploy automatico de produção (`.github/workflows/deploy.yml`).

Guard automatico: `.github/workflows/branch-flow-guard.yml` marca com falha
qualquer PR que mire `main` sem vir de `stage`. Escape hatch para hotfix urgente
de produção: branch `hotfix/<slug>` ou label `hotfix` no PR.

**Todo hotfix aplicado direto em `main` exige backport imediato para `stage`**:

```bash
git fetch origin
git checkout stage
git pull --ff-only origin stage
git merge origin/main      # so agora origin/main inclui o hotfix
git push origin stage
```

O `git fetch` no inicio nao e opcional: sem ele, `origin/main` local pode estar
anterior ao hotfix, o merge nao traz nada e o push "conclui" com `stage` ainda
sem a correcao. Enquanto `main`
tiver commit que `stage` nao tem, a promocao seguinte roda com
`git merge -X theirs origin/stage` (default de `promote_stage_to_main.sh`), que
resolve conflito em favor de `stage` **sem avisar** — ou seja, pode desfazer
silenciosamente a correcao de emergencia. Se por qualquer motivo o backport nao
tiver sido feito, promova com `PREFER_STAGE_ON_CONFLICTS=0
bash scripts/promote_stage_to_main.sh` e resolva os conflitos a mao.

Passo manual pendente (precisa de admin do repositorio, nao da para automatizar
por API nesta sessao):

- **Default branch = `stage`** em Settings -> General -> Default branch. Sem
  isso, todo PR novo (inclusive os abertos por agentes) continua nascendo com
  base `main` e o guard so avisa depois.
- Opcional, para bloquear de fato: Settings -> Branches -> proteger `main`
  exigindo PR + o check `Branch Flow Guard`. O guard sozinho sinaliza, mas nao
  impede o merge nem cobre push direto em `main`.

Workflow manual que aplique algo em produção precisa de duas travas, porque em
`workflow_dispatch` o YAML executado vem do ref selecionado no dispatch (e esse
ref default acompanha o default branch do repositorio):

1. `ref: main` no `actions/checkout` — garante que os arquivos copiados para a
   VPS sao os promovidos, nao os de `stage`.
2. Passo inicial exigindo `github.ref == refs/heads/main` — garante que os
   proprios passos `run` do job sao os promovidos. O checkout pinado nao cobre
   isso.

Aplicado em `sync-portal-email-env.yml`, `provision-institutional-host.yml`,
`recover-frases-prod.yml` e (condicionado a `environment=production`)
`fix-database.yml`.

Limite conhecido: esses dois guards vivem dentro do proprio workflow, que vem do
ref do dispatch — logo protegem contra **acidente** (rodar produção a partir de
`stage` sem perceber), nao contra edicao deliberada do workflow em `stage` por
quem tem permissao de push. A trava real para esse caso e do lado do GitHub:
mover `VPS_SSH_KEY`/`VPS_HOST`/`VPS_SUDO_PASSWORD` para um Environment
(Settings -> Environments) chamado `production`, com required reviewers e
limitado a branch `main`, para que qualquer job que use esses secrets dependa de
aprovacao humana.

Antes de migrar, saiba quem consome esses secrets: **seis jobs**, nao quatro. Os
quatro manuais (`sync-portal-email-env`, `provision-institutional-host`,
`recover-frases-prod`, `fix-database`) ja declaram `environment:` no YAML — esses
estao prontos. Os dois deploys automaticos (`deploy.yml` job `deploy` e
`deploy-stage.yml` job `deploy-stage`) tambem usam `VPS_SSH_KEY`/`VPS_HOST` e
**nao** tem binding: remover os secrets do repositorio sem trata-los quebra todo
push em `main` e em `stage`.

Duas formas de fazer, e a escolha e do dono do repositorio:

1. **Gatear so os manuais** (pragmatico): crie o Environment `production` com
   required reviewers limitado a `main` e coloque copias dos tres secrets nele;
   mantenha os secrets de repositorio para os deploys automaticos continuarem
   sem aprovacao. Os dispatches manuais passam a exigir revisor humano; o
   deploy automatico segue como hoje. Limite: como os secrets seguem no
   repositorio, a protecao nao cobre o caminho do deploy automatico.
2. **Gatear tudo** (estrito): adicione `environment: production` ao job `deploy`
   de `deploy.yml` e `environment: stage` ao job `deploy-stage` de
   `deploy-stage.yml`, mova os secrets para os Environments e remova do
   repositorio. Consequencia direta: com required reviewers em `production`,
   **todo push em `main` passa a esperar aprovacao humana** antes de deployar —
   ou seja, produção deixa de ser deploy desatendido.

Enquanto um Environment nao tiver regras configuradas, o binding nao muda
comportamento: os secrets de repositorio continuam funcionando normalmente.

## Fluxo recomendado (automatizado)

### 1) Local: promover stage -> main sem tocar no runtime local

```bash
cd <repo>
bash scripts/promote_stage_to_main.sh
```

### 2) VPS Stage: deploy padronizado

```bash
cd /var/www/fortcordis-stage
bash scripts/deploy_stage_vps.sh
```

Preflight WhatsApp stage (recomendado):

```bash
cd /var/www/fortcordis-stage
RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh
```

Incidente operacional WhatsApp (API/auth/webhook/cleanup):

```bash
# Referencia de resposta operacional
cat docs/WHATSAPP-INCIDENT-RUNBOOK.md
```

### 3) VPS Prod: deploy padronizado

```bash
cd /var/www/fortcordis-v2
bash scripts/deploy_prod_vps.sh
```

Notas:
- O script de prod evita `git stash pop` e faz `git reset --hard origin/main`.
- O script valida backend health (`/health`) e frontend (`.next/BUILD_ID` + HTTP local/publico).

## 0) Padrao de ambientes

- Stage:
  - raiz: `/var/www/fortcordis-stage`
  - frontend: `3001`
  - backend: `8001`
  - services: `fortcordis-stage-frontend`, `fortcordis-stage-backend`
  - Supabase org: `Fortcordis Stage`
  - Supabase project ref: `dtguubpzjrkvqjryazjq`
- Prod:
  - raiz: `/var/www/fortcordis-v2`
  - frontend: `3000`
  - backend: `8000`
  - services: `fortcordis-frontend`, `fortcordis-backend`
  - Supabase org: `martinialebarros-svg's Org`
  - Supabase project ref: `wycxoueogfxdhyouhfhw`

Checklist rapido:

- Antes de qualquer deploy ou manutencao sensivel, rode `python3 scripts/check_environment_matrix.py`.
- Nunca confie apenas no nome visual do projeto no painel do Supabase.
- Valide sempre o `project ref` do ambiente alvo.

## 1) Pre-check obrigatorio (antes da promocao)

### 1.1 Confirmar branch/commit

```bash
cd /var/www/fortcordis-stage
git rev-parse --short HEAD
git log --oneline -n 5
```

### 1.2 Confirmar isolamento de config (stage != prod)

```bash
python3 - <<'PY'
import re
from urllib.parse import urlparse

envs = {
    "PROD": "/var/www/fortcordis-v2/backend/.env",
    "STAGE": "/var/www/fortcordis-stage/backend/.env",
}

for name, path in envs.items():
    txt = open(path, encoding="utf-8").read()
    db = re.search(r"^DATABASE_URL=(.+)$", txt, re.M).group(1).strip()
    sk = re.search(r"^SECRET_KEY=(.+)$", txt, re.M)
    u = urlparse(db)
    print(f"{name}: user={u.username} host={u.hostname}:{u.port} secret={'OK' if sk else 'MISSING'}")
PY
```

Esperado:
- `DATABASE_URL` diferente entre stage/prod (project_ref diferente)
- `SECRET_KEY` presente nos dois
- `PROD` usando ref `wycxoueogfxdhyouhfhw`
- `STAGE` usando ref `dtguubpzjrkvqjryazjq`

## 2) Backup rapido (sempre antes do deploy)

```bash
# backend envs
cp /var/www/fortcordis-v2/backend/.env /var/www/fortcordis-v2/backend/.env.bak.$(date +%F-%H%M)
cp /var/www/fortcordis-stage/backend/.env /var/www/fortcordis-stage/backend/.env.bak.$(date +%F-%H%M)

# nginx app/stage
sudo cp /etc/nginx/sites-available/fortcordis-app /etc/nginx/sites-available/fortcordis-app.bak.$(date +%F-%H%M)
sudo cp /etc/nginx/sites-available/fortcordis /etc/nginx/sites-available/fortcordis.bak.$(date +%F-%H%M) 2>/dev/null || true
sudo cp /etc/nginx/sites-available/fortcordis-stage /etc/nginx/sites-available/fortcordis-stage.bak.$(date +%F-%H%M) 2>/dev/null || true
```

Opcional (recomendado): backup SQL do banco prod

```bash
cd /var/www/fortcordis-v2/backend
set -a; source .env; set +a
pg_dump "$DATABASE_URL" > ~/fortcordis-prod-$(date +%F-%H%M).sql
```

## 3) Promocao Stage -> Prod

### 3.1 Atualizar codigo em prod

```bash
cd /var/www/fortcordis-v2
git fetch origin
git checkout main
git pull --ff-only origin main
```

Se houver mensagem de branch divergente:

```bash
git pull --rebase origin main
```

### 3.2 Backend: deps + setup/migracoes

```bash
cd /var/www/fortcordis-v2/backend

# garantir venv correto
python3 -m venv venv
/var/www/fortcordis-v2/backend/venv/bin/python -m pip install -U pip
/var/www/fortcordis-v2/backend/venv/bin/pip install -r requirements.txt

# garantir .env carregado
set -a; source .env; set +a

# setup e migracoes versionadas
/var/www/fortcordis-v2/backend/venv/bin/python setup_database.py
```

### 3.3 Frontend: build limpo

```bash
cd /var/www/fortcordis-v2/frontend
rm -rf .next
npm ci
API_BACKEND_URL=http://127.0.0.1:8000 npm run build
```

### 3.4 Restart de servicos

```bash
sudo systemctl restart fortcordis-backend
sudo systemctl restart fortcordis-frontend
```

## 4) Validacao pos deploy (smoke de 2 minutos)

### 4.1 Infra/API local

```bash
ss -lntp | egrep ':3000|:8000|:3001|:8001'
curl -sS http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

### 4.2 Rotas publicas

```bash
curl -I https://app.fortcordis.com.br
curl -I https://stage.fortcordis.com.br
```

### 4.3 Teste funcional manual em prod

1. Login
2. Agenda abre sem erro
3. Criar novo agendamento
4. Criar laudo
5. Baixar PDF do laudo

### 4.4 Regressao de seguranca (recomendado)

```bash
bash scripts/security_regression_smoke.sh
```

Referencia completa:

- `docs/SECURITY-REGRESSION-CHECKLIST.md`

Se falhar:

```bash
sudo journalctl -u fortcordis-backend -n 120 --no-pager
sudo journalctl -u fortcordis-frontend -n 120 --no-pager
```

## 5) Rollback rapido

### 5.1 Rollback de codigo

```bash
cd /var/www/fortcordis-v2
git log --oneline -n 5
git reset --hard <COMMIT_ANTERIOR>
```

### 5.2 Restaurar config

```bash
cp /var/www/fortcordis-v2/backend/.env.bak.<YYYY-MM-DD-HHMM> /var/www/fortcordis-v2/backend/.env
sudo cp /etc/nginx/sites-available/fortcordis-app.bak.<YYYY-MM-DD-HHMM> /etc/nginx/sites-available/fortcordis-app
sudo nginx -t && sudo systemctl reload nginx
```

### 5.3 Restart

```bash
sudo systemctl restart fortcordis-backend
sudo systemctl restart fortcordis-frontend
```

## 6) Notas de operacao

- `health` atual do backend retorna `connected` fixo; para validar banco use `psql "$DATABASE_URL" -c "select current_user, now();"`
- Em Supabase, prefira URL de `pooler` no VPS quando `direct` falhar por IPv6.
- `DATABASE_URL` e `SECRET_KEY` devem ser diferentes entre stage e prod.
- O projeto stage foi transferido para organizacao `Free`; ele pode pausar por inatividade.
- Renomeie o projeto stage no Supabase para `fortcordis-stage` assim que possivel para evitar confusao no painel.
