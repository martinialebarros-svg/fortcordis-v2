# 🚀 Correção Rápida - Stage FortCordis

Execute estes comandos na VPS para corrigir os problemas:

## 1. Acessar a VPS

```bash
ssh root@stage.fortcordis.com.br
```

## 2. Executar Correção Completa

```bash
cd /var/www/fortcordis-v2

# Puxar últimas alterações do git
git pull origin main

# Dar permissão e executar script de correção
chmod +x backend/fix_vps.sh
cd backend
./fix_vps.sh
```

## 3. Se o script acima falhar, execute manualmente:

```bash
cd /var/www/fortcordis-v2/backend

# Ativar ambiente virtual
source venv/bin/activate

# Verificar diagnóstico
python3 diagnostico_vps.py

# Criar tabelas e seeds
python3 setup_database.py

# Reiniciar serviço
sudo systemctl restart fortcordis-backend

# Verificar status
sudo systemctl status fortcordis-backend --no-pager
```

## 4. Verificar se funcionou

```bash
# Testar endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/clinicas
curl http://localhost:8000/api/v1/frases
```

## 5. Verificar logs se houver erro

```bash
sudo journalctl -u fortcordis-backend -n 50 --no-pager
```

---

## 🔧 Problemas Específicos

### Erro 500 nos endpoints

Causa: Tabelas não criadas no banco
Solução:
```bash
cd /var/www/fortcordis-v2/backend
source venv/bin/activate
python3 setup_database.py
sudo systemctl restart fortcordis-backend
```

### Modo M vazio no XML

Causa: Parser não reconhece os parâmetros
Solução: O novo parser já está no código, apenas puxe as alterações:
```bash
cd /var/www/fortcordis-v2
git pull origin main
sudo systemctl restart fortcordis-backend
```

### CSV de referências não importa

Causa: Tabela `referencias_eco` não existe
Solução:
```bash
cd /var/www/fortcordis-v2/backend
source venv/bin/activate
python3 setup_database.py
```

### Frases não aparecem

Causa: Seed de frases não executado
Solução:
```bash
cd /var/www/fortcordis-v2/backend
source venv/bin/activate
python3 create_frase_tables.py
```

---

## ✅ Verificação Final

Após as correções, teste no navegador:
1. Acesse: https://stage.fortcordis.com.br
2. Faça login
3. Verifique se clínicas carregam
4. Verifique se frases aparecem
5. Teste importar um XML

Se ainda houver problemas, execute:
```bash
sudo journalctl -u fortcordis-backend -n 100 --no-pager > /tmp/logs.txt
cat /tmp/logs.txt
```

E envie o conteúdo de `/tmp/logs.txt` para análise.
