# 🛠️ Troubleshooting - FortCordis v2 na VPS

Este guia ajuda a diagnosticar e corrigir problemas do FortCordis v2 rodando na VPS.

---

## 🚨 Problemas Comuns

### 1. Erros 500 em múltiplos endpoints

**Sintomas:**
- `/api/v1/clinicas` retorna 500
- `/api/v1/frases` retorna 500
- `/api/v1/referencias-eco` retorna 500

**Causas prováveis:**
1. Tabelas do banco de dados não foram criadas
2. Conexão com o banco falhou
3. Variáveis de ambiente não configuradas

**Solução:**

```bash
# Acesse a VPS via SSH
ssh root@stage.fortcordis.com.br

# Vá para o diretório do projeto
cd /var/www/fortcordis-v2/backend

# Execute o script de correção
chmod +x fix_vps.sh
./fix_vps.sh
```

Se o script acima não funcionar, execute manualmente:

```bash
# 1. Verificar variáveis de ambiente
cat .env

# 2. Verificar se DATABASE_URL está definido
export $(cat .env | grep -v '^#' | xargs)
echo $DATABASE_URL

# 3. Criar tabelas manualmente
python3 setup_database.py

# 4. Reiniciar o serviço
sudo systemctl restart fortcordis-backend

# 5. Verificar logs
sudo journalctl -u fortcordis-backend -n 50 --no-pager
```

---

### 2. XML não é importado completamente (Modo M vazio)

**Sintomas:**
- XML importa dados do paciente
- Seção de modo M (VE) fica vazia

**Causas prováveis:**
1. O parser XML não reconhece os nomes dos parâmetros no XML
2. Os parâmetros têm prefixos diferentes (MM/, 2D/, etc.)

**Solução:**

O novo parser (`xml_parser_v2.py`) já inclui mais variações de nomes. Para aplicar:

```bash
cd /var/www/fortcordis-v2

# Puxar últimas alterações
git pull origin main

# Reiniciar o serviço
sudo systemctl restart fortcordis-backend
```

**Para debugar um XML específico:**

1. Acesse o console do navegador (F12)
2. Tente importar o XML
3. Veja no console quais parâmetros foram encontrados
4. Compare com os nomes esperados em `backend/app/utils/xml_parser_v2.py`

---

### 3. Não consegue importar CSV de referências

**Sintomas:**
- Upload do CSV falha
- Erro 500 ao importar

**Causas prováveis:**
1. Tabela `referencias_eco` não existe
2. Formato do CSV não corresponde ao esperado

**Solução:**

```bash
# Verificar se a tabela existe
cd /var/www/fortcordis-v2/backend
python3 -c "
from app.db.database import engine
from sqlalchemy import inspect
inspector = inspect(engine)
print('Tabelas:', inspector.get_table_names())
"

# Se faltar a tabela, criar
python3 setup_database.py
```

**Formato esperado do CSV (Caninos):**
```csv
Peso (kg),LVIDd_Min,LVIDd_Max,IVSd_Min,IVSd_Max,...
5.0,25.0,30.0,8.0,10.0,...
```

---

### 4. Frases não aparecem no sistema

**Sintomas:**
- Lista de frases qualitativas vazia
- Patologias não carregam

**Solução:**

```bash
cd /var/www/fortcordis-v2/backend

# Executar seed de frases
python3 -c "
from app.db.database import SessionLocal
from app.utils.frases_seed import seed_frases
db = SessionLocal()
seed_frases(db)
db.close()
"

# Ou recriar as tabelas com seed
python3 create_frase_tables.py
```

---

## 🔍 Comandos de Diagnóstico

### Verificar status do serviço
```bash
sudo systemctl status fortcordis-backend --no-pager
```

### Ver logs em tempo real
```bash
sudo journalctl -u fortcordis-backend -f
```

### Testar endpoint de health
```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/db
```

### Verificar tabelas no banco (PostgreSQL)
```bash
# Conectar ao banco
psql $DATABASE_URL

# Listar tabelas
\dt

# Contar registros
SELECT COUNT(*) FROM frases_qualitativas;
SELECT COUNT(*) FROM clinicas;
```

### Verificar tabelas no banco (SQLite)
```bash
# No diretório backend
sqlite3 fortcordis.db ".tables"
sqlite3 fortcordis.db "SELECT COUNT(*) FROM frases_qualitativas;"
```

---

## 📝 Checklist de Deploy

Após cada deploy, verifique:

- [ ] Serviço está rodando: `sudo systemctl is-active fortcordis-backend`
- [ ] Health check responde: `curl http://localhost:8000/health`
- [ ] Banco está conectado: `curl http://localhost:8000/health/db`
- [ ] Tabelas existem: `curl http://localhost:8000/health/tabelas`
- [ ] Frases carregam: `curl http://localhost:8000/api/v1/frases`
- [ ] Clínicas carregam: `curl http://localhost:8000/api/v1/clinicas`

---

## 🆘 Recuperação de Emergência

Se o sistema parar completamente:

```bash
# 1. Acessar a VPS
ssh root@stage.fortcordis.com.br

# 2. Ir para o projeto
cd /var/www/fortcordis-v2

# 3. Restaurar backup (se necessário)
# ls backups/
# tar -xzf backups/backup_YYYYMMDD_HHMMSS.tar.gz

# 4. Recriar ambiente virtual
rm -rf backend/venv
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Recriar banco (CUIDADO: apaga dados!)
# python3 setup_database.py

# 6. Reiniciar serviço
sudo systemctl restart fortcordis-backend

# 7. Verificar logs
sudo journalctl -u fortcordis-backend -n 100 --no-pager
```

---

## 📞 Contato

Se os problemas persistirem, verifique:
1. Logs completos: `sudo journalctl -u fortcordis-backend > logs.txt`
2. Envie o arquivo `logs.txt` para análise
