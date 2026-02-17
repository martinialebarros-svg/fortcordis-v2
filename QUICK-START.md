# ⚡ Quick Start - Deploy Automático

Guia rápido para configurar o deploy automático em 10 minutos.

---

## 🎯 Passo a Passo Rápido

### 1️⃣ NA SUA MÁQUINA LOCAL

```bash
# Clone o repositório
git clone https://github.com/martinialebarros-svg/fortcordis-v2.git
cd fortcordis-v2

# Criar branch develop
git checkout -b develop
git push -u origin develop

# Criar pasta de workflows
mkdir -p .github/workflows

# Copiar o arquivo deploy.yml (que você baixou) para cá
cp /caminho/do/deploy.yml .github/workflows/

# Commit e push
git add .github/workflows/deploy.yml
git commit -m "chore: adiciona workflow de deploy automático"
git push origin main
```

---

### 2️⃣ NA VPS (SSH)

```bash
# Acesse sua VPS
ssh usuario@SEU_IP_VPS

# Criar diretório
sudo mkdir -p /var/www/fortcordis-v2
sudo chown $USER:$USER /var/www/fortcordis-v2

# Clonar repositório
cd /var/www/fortcordis-v2
git clone https://github.com/martinialebarros-svg/fortcordis-v2.git .

# Copiar deploy.sh (que você baixou)
# Use scp da sua máquina local:
# scp deploy.sh usuario@SEU_IP_VPS:/var/www/fortcordis-v2/

# Tornar executável
chmod +x /var/www/fortcordis-v2/deploy.sh

# Gerar chave SSH para GitHub Actions
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Mostrar chave PÚBLICA (copie para adicionar no authorized_keys)
cat ~/.ssh/github_actions.pub

# Mostrar chave PRIVADA (copie para adicionar no GitHub Secrets)
cat ~/.ssh/github_actions
```

---

### 3️⃣ NO GITHUB

Vá em: `Settings → Secrets and variables → Actions → New repository secret`

Adicione 3 secrets:

| Nome | Valor |
|------|-------|
| `VPS_HOST` | SEU_IP_VPS |
| `VPS_USER` | usuario_da_vps |
| `VPS_SSH_KEY` | (cole a chave privada inteira) |

---

### 4️⃣ NA VPS (continuação)

```bash
# Adicionar chave pública do GitHub Actions
# (substitua pela chave que você gerou)
echo "ssh-ed25519 AAAAC3NzaC... github-actions" >> ~/.ssh/authorized_keys

# Testar deploy manual
/var/www/fortcordis-v2/deploy.sh
```

---

### 5️⃣ TESTAR DEPLOY AUTOMÁTICO

Na sua máquina local:

```bash
cd fortcordis-v2

# Criar uma alteração de teste
echo "# Teste de deploy" >> README.md

git add README.md
git commit -m "test: verifica deploy automático"
git push origin main
```

**Verifique no GitHub:**
- Vá em `Actions` no seu repositório
- Você deve ver o workflow rodando!

**Verifique na VPS:**
```bash
# Acompanhe o deploy
tail -f /var/www/fortcordis-v2/deploy.log
```

---

## 🔄 Novo Workflow de Trabalho

Depois de configurado, seu fluxo será:

```bash
# 1. Desenvolva localmente
git checkout -b feature/minha-feature
# ... faça alterações ...

# 2. Teste localmente
# Backend: cd backend && source venv/bin/activate && uvicorn app.main:app --reload
# Frontend: cd frontend && npm run dev

# 3. Commit e push
git add .
git commit -m "feat: descrição da feature"
git push origin feature/minha-feature

# 4. Crie Pull Request no GitHub
# feature/minha-feature → develop

# 5. Depois de testado, merge para main
# develop → main
# 🚀 Deploy automático acontece!
```

---

## 🛠️ Comandos Úteis

### Na VPS:

```bash
# Ver logs do deploy
tail -f /var/www/fortcordis-v2/deploy.log

# Ver logs do backend
sudo journalctl -u fortcordis-backend -f

# Ver logs do frontend  
sudo journalctl -u fortcordis-frontend -f

# Deploy manual
/var/www/fortcordis-v2/deploy.sh

# Status dos serviços
sudo systemctl status fortcordis-backend
sudo systemctl status fortcordis-frontend

# Restart manual
sudo systemctl restart fortcordis-backend
sudo systemctl restart fortcordis-frontend
```

### Na máquina local:

```bash
# Atualizar com últimas alterações
git pull origin main

# Criar nova feature
git checkout -b feature/nome-da-feature

# Voltar para main
git checkout main

# Ver branches
git branch -a

# Deletar branch local
git branch -d feature/nome-da-feature
```

---

## ✅ Checklist Final

- [ ] Repositório clonado localmente
- [ ] Branch `develop` criada
- [ ] Workflow copiado para `.github/workflows/`
- [ ] Diretório `/var/www/fortcordis-v2` criado na VPS
- [ ] `deploy.sh` copiado e executável na VPS
- [ ] Chave SSH gerada na VPS
- [ ] Secrets configurados no GitHub
- [ ] Chave pública adicionada em `~/.ssh/authorized_keys`
- [ ] Teste de deploy realizado com sucesso

---

## 🆘 Problemas Comuns

### "Permission denied" no deploy
```bash
# Na VPS, verifique permissões
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### "deploy.sh: command not found"
```bash
# Tornar executável
chmod +x /var/www/fortcordis-v2/deploy.sh
```

### Workflow não aparece no GitHub
```bash
# Verifique se o arquivo está no lugar certo
ls -la .github/workflows/deploy.yml

# Commit e push novamente
git add .github/workflows/
git commit -m "fix: corrige workflow"
git push origin main
```

---

Pronto! Agora você tem deploy automático configurado! 🎉

Para mais detalhes, veja o arquivo `README-DEPLOY.md` completo.
