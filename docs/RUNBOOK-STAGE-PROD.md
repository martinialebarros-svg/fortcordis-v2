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
4. Promocao para produção pelo **PR de release** `stage -> main` (titulo
   `chore(release): promover <resumo>`), mergeado com merge commit — squash
   faria `main` divergir de `stage` e criaria conflito na promocao seguinte.
5. Merge em `main` -> deploy automatico de produção (`.github/workflows/deploy.yml`).

Guards automaticos, os dois em `on: pull_request`:

- `.github/workflows/branch-flow-guard.yml` marca com falha qualquer PR que mire
  `main` sem vir de `stage`. Escape hatch para hotfix urgente de produção:
  branch `hotfix/<slug>` ou label `hotfix` no PR.
- `.github/workflows/promotion-verify-guard.yml` barra promocao que leve
  criterio de aceitacao ainda `pendente` na matriz do `verify.md` das features
  no diff. Label de excecao: `promocao-com-pendencia`.

**Por que nao usar `scripts/promote_stage_to_main.sh` como rota normal:** ele
termina em `git push origin HEAD:main`, e `main` nao tem protecao de branch.
Como os dois guards so rodam em PR, o script nao dispara nenhum deles — e um
criterio pendente chega em produção sem ninguem ser avisado. O script continua
no repo como escape hatch; de quem o usa se espera saber que esta pulando a
verificacao.

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
tiver commit que `stage` nao tem, a promocao seguinte resolve conflito em favor
de `stage` **sem avisar** — ou seja, pode desfazer silenciosamente a correcao de
emergencia (o `-X theirs` e o default do `promote_stage_to_main.sh`, mas o mesmo
risco existe em qualquer merge feito nessa direcao).

Se por qualquer motivo o backport nao tiver sido feito, faca o backport **antes**
de promover, pelo bloco acima. Nao ha atalho pela promocao: o
`branch-flow-guard` so aceita PR para `main` vindo de `stage`, entao o conflito
tem de ser resolvido em `stage` de qualquer jeito. Com `stage` ja contendo
`main`, o PR de promocao nao tem o que resolver em favor de ninguem.

### Checks obrigatorios (feito em 2026-09-14)

Existem duas rulesets ativas, uma por branch, criadas pela API:

| ruleset | branch | checks obrigatorios |
| --- | --- | --- |
| `Checks obrigatorios - stage` | `refs/heads/stage` | `tipos-devem-compilar`, `testes-devem-passar`, `migration-tests`, `sdd-guardrail` |
| `Checks obrigatorios - main` | `refs/heads/main` | os quatro acima, mais `base-deve-ser-promocao` e `criterios-devem-estar-fechados` |

As duas tambem trazem `deletion` e `non_fast_forward`. Sem bypass actors: valem
inclusive para quem administra o repositorio.

**Por que duas e nao uma.** `base-deve-ser-promocao` e
`criterios-devem-estar-fechados` rodam so em PR que mira `main`. Numa ruleset que
cobrisse `stage`, seriam exigidos e nunca reportariam -- e check obrigatorio que
nao roda deixa o PR parado em "Expected -- waiting for status to be reported",
sem erro e sem vermelho. Por isso ficam so na ruleset de `main`.

Pela mesma razao, o filtro `paths` foi removido de `frontend-ci.yml` antes de
tornar os gates obrigatorios -- ver `docs/specs/ci-frontend-gates-sem-paths/`.
Nao reintroduza o filtro sem tirar os checks da lista de obrigatorios.

**Nao foi exigido PR antes do merge**, por decisao do responsavel. O gate de
status ja barra push direto que nao tenha checks aprovados em outra ref, o que
na pratica encerra o `promote_stage_to_main.sh` -- coerente com a secao "Promova
pelo PR, nao pelo script" do `CLAUDE.md`.

### WhatsApp: stage nao valida modelo aprovado

As contas do WhatsApp Business de stage e de producao sao **diferentes** --
outros modelos aprovados, outros numeros registrados.

Qualquer fluxo que dependa de modelo aprovado da Meta (lembrete de consulta,
recibo, aviso de laudo, convite de clinica) **sempre falha em stage**: o modelo
nao existe naquela conta e a Meta responde 4xx. A falha nao indica defeito.

Isso torna impossivel a etapa "testar em stage antes de promover" para esses
fluxos -- a validacao so pode acontecer em producao, com um numero proprio como
destino. Detalhe e evidencia em
`docs/specs/whatsapp-portal-clinic-invite-template/verify.md`, secao final.

### Default branch = `stage` (feito em 2026-09-15)

Era o ultimo passo manual pendente desta secao. Aplicado por
`PATCH /repos/{owner}/{repo}` com `default_branch=stage`.

Com isso, PR novo nasce com base `stage` -- inclusive os abertos por agentes --
em vez de nascer mirando `main` e depender do `base-deve-ser-promocao` para
avisar depois. `git clone` passa a trazer `stage`.

**Conferido antes de trocar**, porque o default branch muda o ref default do
`workflow_dispatch`, e com ele o YAML que roda num disparo manual: os quatro
workflows que aplicam algo em produção (`sync-portal-email-env`,
`provision-institutional-host`, `recover-frases-prod` e `fix-database`) abortam
quando `DISPATCH_REF != refs/heads/main`, e tres deles ainda fixam `ref: main`
no checkout. A troca nao expoe produção por acidente.

O limite ja registrado acima continua valendo: esses guards protegem contra
acidente, nao contra edicao deliberada do workflow por quem tem push.

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
quem tem permissao de push.

Fechar essa segunda ameaca nao e ajuste de YAML, e um trabalho proprio, ainda
nao feito:

- `VPS_SSH_KEY`/`VPS_HOST`/`VPS_SUDO_PASSWORD` sao secrets de repositorio e
  **as mesmas credenciais servem stage e produção** — nao existe hoje credencial
  separada por ambiente.
- Nove jobs os consomem: os 4 manuais de produção, os 3 manuais de stage
  (`recover-frases-stage`, `sync-frases-store-stage`, `sync-frases-to-stage`) e
  os 2 deploys automaticos (`deploy`, `deploy-stage`).
- Enquanto as credenciais estiverem no escopo do repositorio, gatear por
  Environment nao impede nada contra quem edita workflow: basta o YAML omitir
  `environment:` e ler o secret do repositorio. Para valer, seria preciso
  credencial exclusiva de stage na VPS, mover as de produção para um Environment
  e vincular todos os consumidores — e, se o deploy automatico de `main` entrar
  nesse Environment com required reviewers, produção deixa de ser deploy
  desatendido.

O que existe hoje: os 4 jobs manuais de produção declaram `environment:
production`. Isso nao fecha a ameaca acima, mas permite uma trava util e barata
— adicionar required reviewers a esse Environment faz **dispatch manual em
produção exigir aprovacao humana**, protegendo contra disparo descuidado.
Enquanto o Environment nao tiver regras, o binding nao muda nada.

## Fluxo recomendado (automatizado)

### 1) Promover stage -> main

Pelo PR de release, para que os guards rodem:

```bash
gh pr create --base main --head stage --title "chore(release): promover <resumo>"
gh pr merge <n> --merge
```

Para antecipar o veredito do gate de criterio pendente, antes de abrir o PR:

```bash
cd scripts/ci && python3 -c "
import check_promotion_verify_pending as g, subprocess
arquivos = subprocess.run(['git','diff','--name-only','origin/main...origin/stage'],
                          capture_output=True, text=True, cwd='../..').stdout.split()
r = g.avaliar(arquivos, '../..')
print(r.passou, r.mensagens)
"
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
