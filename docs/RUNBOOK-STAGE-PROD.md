# Runbook Stage -> Prod (FortCordis)

Este runbook descreve o processo seguro para promover codigo de `stage` para `prod` com downtime minimo.

## 0) Padrao de ambientes

- Stage:
  - raiz: `/var/www/fortcordis-stage`
  - frontend: `3001`
  - backend: `8001`
  - services: `fortcordis-stage-frontend`, `fortcordis-stage-backend`
- Prod:
  - raiz: `/var/www/fortcordis-v2`
  - frontend: `3000`
  - backend: `8000`
  - services: `fortcordis-frontend`, `fortcordis-backend`

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
git checkout stage
git pull --ff-only origin stage
```

Se houver mensagem de branch divergente:

```bash
git pull --rebase origin stage
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
