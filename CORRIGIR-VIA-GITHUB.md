# 🔧 Corrigir VPS via GitHub Actions

Como você não consegue acessar via SSH localmente, use o GitHub Actions para corrigir remotamente.

---

## ⚡ Opção 1: Executar Correção Manual (Recomendado)

### Passo a passo:

1. **Acesse o repositório no GitHub**
   - https://github.com/seu-usuario/fortcordis-v2/actions

2. **Execute o workflow de correção**
   - Clique em **"Fix Database (Manual)"** na lista de workflows
   - Clique no botão **"Run workflow"** (canto superior direito)
   - Selecione o ambiente: `stage`
   - Clique em **"Run workflow"**

3. **Aguarde a execução**
   - O workflow vai:
     - Conectar na VPS via SSH
     - Atualizar o código
     - Executar o diagnóstico
     - Criar tabelas faltantes
     - Executar seeds de frases
     - Reiniciar o serviço

4. **Verifique o resultado**
   - Acesse: https://stage.fortcordis.com.br
   - Teste se clínicas e frases estão carregando

---

## 🚀 Opção 2: Fazer Deploy (também corrige o banco)

O workflow de deploy agora inclui a correção automática do banco:

```bash
# No seu computador (PowerShell)
git push origin main:stage
```

Isso vai:
1. Fazer deploy do código
2. **Automaticamente executar `setup_database.py`**
3. Reiniciar os serviços

---

## ✅ Verificação

Após a execução, verifique se funcionou:

```powershell
# Testar endpoints
Invoke-RestMethod -Uri "https://stage.fortcordis.com.br/api/v1/clinicas" -Method GET
Invoke-RestMethod -Uri "https://stage.fortcordis.com.br/api/v1/frases" -Method GET
```

Ou acesse no navegador:
- https://stage.fortcordis.com.br/api/v1/health
- https://stage.fortcordis.com.br/api/v1/health/db
- https://stage.fortcordis.com.br/api/v1/health/tabelas

---

## 📝 Resumo

| Problema | Solução via GitHub |
|----------|-------------------|
| Erros 500 nos endpoints | Execute workflow **"Fix Database (Manual)"** |
| Modo M vazio no XML | Faça push para branch `stage` (já tem o novo parser) |
| CSV não importa | Execute workflow **"Fix Database (Manual)"** |
| Frases não aparecem | Execute workflow **"Fix Database (Manual)"** |

---

## ❓ Ainda com problemas?

Se o workflow falhar, verifique:

1. **Os secrets estão configurados?**
   - VPS_SSH_KEY
   - VPS_HOST
   - VPS_USER

2. **Acesse os logs do workflow:**
   - No GitHub Actions, clique no workflow que falhou
   - Veja qual step deu erro
   - Copie o erro e me envie

3. **Alternativa final:**
   - Acesse o painel da VPS pelo navegador (DigitalOcean, AWS, etc.)
   - Use o console web embutido
   - Execute os comandos manualmente lá
