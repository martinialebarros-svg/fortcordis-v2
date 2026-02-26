# Deploy no ambiente Stage (www.stage.fortcordis.com.br)

Este guia descreve como subir a aplicação para o domínio de teste **stage.fortcordis.com.br** usando VPS, Cloudflare, Supabase e GitHub.

---

## 1. Commit e push para o GitHub

Você já fez o commit. Para o stage usar essa versão:

```bash
# Enviar sua branch atual para o remoto (se ainda não enviou)
git push origin feature/laudos-pdf-imagens

# Criar/atualizar a branch 'stage' com o mesmo código e disparar o deploy automático
git push origin feature/laudos-pdf-imagens:stage
```

Sempre que quiser atualizar o stage com o código da sua branch atual:

```bash
git push origin feature/laudos-pdf-imagens:stage
```

(O workflow **Deploy to Stage** dispara em **push na branch `stage`**.)

---

## 2. VPS – preparar o ambiente stage (uma vez)

Na VPS, o deploy atual vai em `/var/www/fortcordis-v2`. O stage deve ficar em outro diretório e em outras portas para não conflitar.

### 2.1 Criar diretório e clonar o repositório

```bash
sudo mkdir -p /var/www/fortcordis-stage
sudo chown $USER:$USER /var/www/fortcordis-stage
cd /var/www
git clone https://github.com/SEU-USUARIO/fortcordis-v2.git fortcordis-stage
cd fortcordis-stage
git checkout stage
```

### 2.2 Backend stage (ex.: porta 8001)

- Criar venv e instalar dependências:
  ```bash
  cd /var/www/fortcordis-stage/backend
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```
- Criar arquivo de ambiente (ex.: `.env`) com:
  - `DATABASE_URL` (pode ser o mesmo Supabase do teste ou outro projeto)
  - Outras variáveis que o backend precise (API keys, etc.)

- Criar unit systemd **fortcordis-stage-backend** (ex.: `/etc/systemd/system/fortcordis-stage-backend.service`):

```ini
[Unit]
Description=Fort Cordis Backend (Stage)
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/fortcordis-stage/backend
Environment="PATH=/var/www/fortcordis-stage/backend/venv/bin"
ExecStart=/var/www/fortcordis-stage/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

Ajuste `User` se for outro (ex.: seu usuário da VPS). Porta **8001** para não bater com o backend de produção (ex.: 8000).

```bash
sudo systemctl daemon-reload
sudo systemctl enable fortcordis-stage-backend
sudo systemctl start fortcordis-stage-backend
```

### 2.3 Frontend stage (ex.: porta 3001)

- Build:
  ```bash
  cd /var/www/fortcordis-stage/frontend
  npm install
  npm run build
  ```
- Configurar variável de ambiente para a API do stage (ex.: `NEXT_PUBLIC_API_URL=https://stage.fortcordis.com.br/api` ou a URL que o front usa).

- Criar unit systemd **fortcordis-stage-frontend** (ex.: `/etc/systemd/system/fortcordis-stage-frontend.service`):

```ini
[Unit]
Description=Fort Cordis Frontend (Stage)
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/fortcordis-stage/frontend
Environment="PORT=3001"
ExecStart=/usr/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
```

Ajuste `User` e o caminho do `npm` se necessário. Porta **3001** para não conflitar com o front de produção.

```bash
sudo systemctl daemon-reload
sudo systemctl enable fortcordis-stage-frontend
sudo systemctl start fortcordis-stage-frontend
```

---

## 3. Nginx – stage.fortcordis.com.br

Criar um server block para o stage (ex.: `/etc/nginx/sites-available/fortcordis-stage`):

```nginx
server {
    listen 80;
    server_name stage.fortcordis.com.br www.stage.fortcordis.com.br;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar e recarregar:

```bash
sudo ln -s /etc/nginx/sites-available/fortcordis-stage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Se usar HTTPS (recomendado), usar certificado (ex.: Certbot) ou proxy no Cloudflare (proximo passo).

---

## 4. Cloudflare

1. **DNS**  
   - Criar registro para **stage** (ou **www.stage**):
     - Tipo: **A** (ou **CNAME** se apontar para outro hostname).
     - Nome: `stage` (ou `www.stage` conforme quiser).
     - Valor: **IP da sua VPS** (ou o hostname que já usa).
   - Assim `stage.fortcordis.com.br` (e, se configurar, `www.stage.fortcordis.com.br`) resolve para a VPS.

2. **Proxy**  
   - Se o proxy laranja (Proxied) estiver ativo, o tráfego passa pelo Cloudflare e você pode usar “SSL/TLS” para “Flexible” ou “Full” conforme seu certificado na origem.

3. **www.stage**  
   - Se quiser que **www.stage.fortcordis.com.br** abra o mesmo site, no Nginx inclua `www.stage.fortcordis.com.br` no `server_name` (como no exemplo) e no Cloudflare crie o registro correspondente (ex.: CNAME `www.stage` → `stage.fortcordis.com.br`).

---

## 5. Supabase

- Pode usar o **mesmo projeto** do teste (com cuidado com dados) ou um **projeto separado** só para stage.
- No **backend stage** (`.env` em `/var/www/fortcordis-stage/backend`), use a `DATABASE_URL` e variáveis de API do projeto Supabase escolhido.
- No **frontend stage**, configure as variáveis de ambiente (ex.: `NEXT_PUBLIC_*`) para apontar para a API do stage (ex.: `https://stage.fortcordis.com.br/api`).

---

## 6. Resumo do fluxo

| Onde        | O quê |
|------------|--------|
| **GitHub** | Branch `stage`; push nela dispara o workflow **Deploy to Stage**. |
| **VPS**    | Código em `/var/www/fortcordis-stage`, backend na 8001, front na 3001, systemd e Nginx para stage. |
| **Cloudflare** | DNS (A/CNAME) para `stage.fortcordis.com.br` (e opcionalmente `www.stage`) apontando para a VPS. |
| **Supabase** | Mesmo ou outro projeto; backend e front stage apontando para as URLs certas. |

Para subir a versão atual (já commitada) no stage:

```bash
git push origin feature/laudos-pdf-imagens:stage
```

Depois que a branch `stage` existir no GitHub e o workflow estiver usando os mesmos secrets (VPS_SSH_KEY, VPS_HOST, VPS_USER) do deploy de produção, o deploy do stage será automático a cada push em `stage`.
