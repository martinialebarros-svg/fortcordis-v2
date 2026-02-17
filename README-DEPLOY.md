# 🚀 Guia de Deploy Automático - FortCordis v2

Este guia configura um workflow de deploy automático do GitHub para sua VPS.

---

## 📋 Sumário

1. [Estrutura de Branches](#1-estrutura-de-branches)
2. [Configuração na VPS](#2-configuração-na-vps)
3. [Configuração no GitHub](#3-configuração-no-github)
4. [Workflow de Desenvolvimento](#4-workflow-de-desenvolvimento)
5. [Rollback](#5-rollback)

---

## 1. Estrutura de Branches

```
main (produção)
  ↑
develop (desenvolvimento)
  ↑
feature/* (features individuais)
```

| Branch | Propósito | Deploy |
|--------|-----------|--------|
| `main` | Código em produção | ✅ Automático na VPS |
| `develop` | Desenvolvimento/integração | ❌ Manual |
| `feature/*` | Novas funcionalidades | ❌ Local only |

### Criar branches:

```bash
# Na sua máquina local
git clone https://github.com/martinialebarros-svg/fortcordis-v2.git
cd fortcordis-v2

# Criar branch develop
git checkout -b develop
git push -u origin develop
```

---

## 2. Configuração na VPS

### 2.1 Preparar diretório do projeto

```bash
# Acesse sua VPS via SSH
ssh usuario@sua-vps

# Criar diretório do projeto
sudo mkdir -p /var/www/fortcordis-v2
sudo chown $USER:$USER /var/www/fortcordis-v2

# Clonar repositório
cd /var/www/fortcordis-v2
git clone https://github.com/martinialebarros-svg/fortcordis-v2.git .

# Configurar Git para pull automático
git config --global user.email "seu-email@exemplo.com"
git config --global user.name "Seu Nome"
```

### 2.2 Copiar script de deploy

```bash
# Copiar o arquivo deploy.sh para a VPS
scp deploy.sh usuario@sua-vps:/var/www/fortcordis-v2/

# Na VPS, tornar executável
chmod +x /var/www/fortcordis-v2/deploy.sh
```

### 2.3 Configurar serviços systemd (opcional mas recomendado)

**Backend (`/etc/systemd/system/fortcordis-backend.service`):**

```ini
[Unit]
Description=FortCordis Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/fortcordis-v2/backend
Environment="PATH=/var/www/fortcordis-v2/backend/venv/bin"
ExecStart=/var/www/fortcordis-v2/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Frontend (`/etc/systemd/system/fortcordis-frontend.service`):**

```ini
[Unit]
Description=FortCordis Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/fortcordis-v2/frontend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Ativar serviços:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable fortcordis-backend
sudo systemctl enable fortcordis-frontend
sudo systemctl start fortcordis-backend
sudo systemctl start fortcordis-frontend
```

### 2.4 Gerar chave SSH para GitHub Actions

```bash
# Na VPS, gerar chave SSH (sem senha)
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Mostrar chave pública (copie para o GitHub)
cat ~/.ssh/github_actions.pub

# Mostrar chave privada (será usada no GitHub Secret)
cat ~/.ssh/github_actions
```

---

## 3. Configuração no GitHub

### 3.1 Adicionar Secrets

Vá em: **Settings → Secrets and variables → Actions**

Adicione estes secrets:

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP ou domínio da sua VPS |
| `VPS_USER` | Usuário SSH (ex: root, ubuntu) |
| `VPS_SSH_KEY` | Conteúdo da chave privada (`~/.ssh/github_actions`) |

### 3.2 Adicionar chave pública na VPS

```bash
# Na VPS, adicionar chave pública do GitHub Actions
# (se ainda não fez no passo 2.4)
echo "ssh-ed25519 AAAA... github-actions" >> ~/.ssh/authorized_keys
```

### 3.3 Copiar workflow para o repositório

```bash
# Na sua máquina local
cd fortcordis-v2
mkdir -p .github/workflows
cp /caminho/do/arquivo/deploy.yml .github/workflows/
git add .github/workflows/deploy.yml
git commit -m "Adiciona workflow de deploy automático"
git push origin main
```

---

## 4. Workflow de Desenvolvimento

### Fluxo recomendado:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. DESENVOLVA LOCALMENTE                                       │
│     git checkout -b feature/nova-funcionalidade                 │
│     # Faça suas alterações                                      │
│     # Teste localmente                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. COMMIT E PUSH                                               │
│     git add .                                                   │
│     git commit -m "feat: adiciona nova funcionalidade"          │
│     git push origin feature/nova-funcionalidade                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. PULL REQUEST PARA DEVELOP                                   │
│     # No GitHub, crie PR: feature → develop                     │
│     # Revise o código                                           │
│     # Faça merge                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. PULL REQUEST PARA MAIN                                      │
│     # No GitHub, crie PR: develop → main                        │
│     # Teste em staging (se tiver)                               │
│     # Faça merge → Deploy automático!                           │
└─────────────────────────────────────────────────────────────────┘
```

### Comandos úteis:

```bash
# Criar nova feature
git checkout -b feature/nome-da-feature

# Atualizar branch com main
git checkout main
git pull origin main
git checkout feature/nome-da-feature
git rebase main

# Enviar alterações
git push origin feature/nome-da-feature
```

---

## 5. Rollback

### Se algo der errado, você tem opções:

**Opção 1: Reverter commit no GitHub**
```bash
# Reverte último commit
git revert HEAD
git push origin main
# Deploy automático reverte na VPS
```

**Opção 2: Restaurar backup na VPS**
```bash
# Na VPS
cd /var/www/fortcordis-v2

# Listar backups
ls -la backups/

# Restaurar backup específico
tar -xzf backups/backup_20250217_120000.tar.gz

# Ou restaurar último backup
LATEST_BACKUP=$(ls -t backups/backup_*.tar.gz | head -1)
tar -xzf $LATEST_BACKUP
```

**Opção 3: Deploy manual**
```bash
# Na VPS
cd /var/www/fortcordis-v2
./deploy.sh
```

---

## 📁 Arquivos Criados

```
fortcordis-deploy-config/
├── .github/
│   └── workflows/
│       └── deploy.yml      # Workflow GitHub Actions
├── deploy.sh               # Script de deploy na VPS
└── README-DEPLOY.md        # Este arquivo
```

---

## ✅ Checklist de Implementação

- [ ] Criar branches `develop` e `main`
- [ ] Configurar diretório na VPS (`/var/www/fortcordis-v2`)
- [ ] Copiar `deploy.sh` para VPS e tornar executável
- [ ] Gerar chave SSH na VPS
- [ ] Adicionar Secrets no GitHub (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`)
- [ ] Adicionar chave pública do GitHub Actions em `~/.ssh/authorized_keys`
- [ ] Copiar workflow para `.github/workflows/deploy.yml`
- [ ] Fazer push do workflow para `main`
- [ ] Testar deploy fazendo uma alteração pequena

---

## 🆘 Troubleshooting

### Deploy falhou?

1. **Verificar logs do GitHub Actions:**
   - Vá em Actions no seu repositório
   - Clique no workflow que falhou
   - Veja os logs de erro

2. **Verificar logs na VPS:**
   ```bash
   # Logs do deploy
   tail -f /var/www/fortcordis-v2/deploy.log

   # Logs do backend
   sudo journalctl -u fortcordis-backend -f

   # Logs do frontend
   sudo journalctl -u fortcordis-frontend -f
   ```

3. **Testar conexão SSH:**
   ```bash
   # Da sua máquina local
   ssh -i ~/.ssh/github_actions usuario@vps
   ```

---

## 📝 Convenções de Commit

Use commits semânticos para melhor organização:

| Tipo | Descrição |
|------|-----------|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Documentação |
| `style:` | Formatação (sem alteração de código) |
| `refactor:` | Refatoração |
| `test:` | Testes |
| `chore:` | Tarefas de manutenção |

**Exemplos:**
```bash
git commit -m "feat: adiciona opção de cancelar agendamento"
git commit -m "fix: corrige exibição de nome dos tutores"
git commit -m "docs: atualiza README com instruções de instalação"
```

---

Pronto! Agora você tem um workflow profissional de deploy automático. 🎉
