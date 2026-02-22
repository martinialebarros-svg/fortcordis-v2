# 🔌 Acesso à VPS - stage.fortcordis.com.br

## Problema: SSH não conecta

A porta SSH (22) parece estar bloqueada ou acessível **apenas via VPN**. A porta HTTPS (443) está respondendo normalmente.

---

## ✅ Verifique se a VPN está conectada

### 1. Verifique seu IP atual
```powershell
# No PowerShell
Invoke-RestMethod -Uri "https://ipinfo.io/json"
```

O IP deve ser da rede da VPN (não do seu provedor local).

### 2. Teste conectividade básica
```powershell
# Testar porta SSH (deve dar "TcpTestSucceeded: True" se VPN estiver on)
Test-NetConnection -ComputerName stage.fortcordis.com.br -Port 22

# Testar se o servidor responde ao ping
ping stage.fortcordis.com.br
```

### 3. Tente SSH com verbose
```powershell
ssh -v root@stage.fortcordis.com.br
```

Isso mostrará em qual etapa está travando.

---

## 🔄 Alternativa 1: GitHub Actions (Deploy Automático)

Se não conseguir acesso SSH, configure um workflow do GitHub Actions para executar as correções:

### Crie o arquivo `.github/workflows/fix-vps.yml`

```yaml
name: Fix VPS Database

on:
  workflow_dispatch:  # Executa manualmente

jobs:
  fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
          
      - name: Fix VPS
        run: |
          ssh -o StrictHostKeyChecking=no root@stage.fortcordis.com.br << 'EOF'
            cd /var/www/fortcordis-v2
            git pull origin main
            cd backend
            chmod +x fix_vps.sh
            ./fix_vps.sh
          EOF
```

### Adicione a chave SSH aos secrets do GitHub:
1. Acesse: https://github.com/seu-repo/settings/secrets/actions
2. Adicione `SSH_PRIVATE_KEY` com sua chave privada

---

## 🔄 Alternativa 2: Executar via Pipeline CI/CD existente

Se já tiver um pipeline de deploy configurado, adicione um step extra:

```bash
# No final do deploy.sh, adicione:
echo "🔧 Verificando banco de dados..."
cd $PROJECT_DIR/backend
source venv/bin/activate
python3 setup_database.py || echo "⚠️ Erro no setup do banco"
```

---

## 🔄 Alternativa 3: API de Administração

Criei um endpoint que pode ser chamado via navegador (requer autenticação) para diagnosticar o sistema:

Após fazer deploy do código atual, acesse:
```
https://stage.fortcordis.com.br/api/v1/health
https://stage.fortcordis.com.br/api/v1/health/db
https://stage.fortcordis.com.br/api/v1/health/tabelas
```

Isso mostrará o status sem precisar de SSH.

---

## 🔄 Alternativa 4: Web Console (se houver)

Se a VPS for da DigitalOcean, Linode, AWS, etc:
1. Acesse o painel da VPS pelo navegador
2. Use o "Console" ou "Web Terminal" embutido
3. Execute os comandos diretamente lá

---

## 🔧 Comandos para executar quando conseguir acesso

Quando conseguir acessar a VPS (via VPN ou console web), execute:

```bash
cd /var/www/fortcordis-v2
git pull origin main
cd backend
source venv/bin/activate
python3 setup_database.py
sudo systemctl restart fortcordis-backend
```

---

## 📞 Próximos passos

1. **Verifique se a VPN está realmente conectada**
   - O site está acessível via VPN?
   - Qual seu IP quando conectado na VPN?

2. **Se VPN estiver ok mas SSH não funciona:**
   - O servidor pode ter SSH em porta diferente (tente porta 2222)
   - Ou só aceita chave SSH (não senha)

3. **Se não conseguir de forma alguma:**
   - Use o GitHub Actions (Alternativa 1)
   - Ou acesse via Web Console da VPS

Qual alternativa prefere tentar?
