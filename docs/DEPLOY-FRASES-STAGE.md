# Frases no Stage: inconsistências e correções

## Como as frases funcionam

- O sistema de laudos usa **apenas arquivos JSON** para frases (não usa mais o banco para isso).
- Arquivos usados:
  - `backend/data/frases.json` – lista de frases (listar, criar, editar, excluir).
  - `backend/data/patologias.json` – patologias e graus.
- O backend lê e **escreve** nesses arquivos. Editar/excluir frases = alterar `frases.json` no disco.

## O que causa a diferença entre local e stage

### 1. **Frases diferentes**

- No deploy (`deploy-stage.yml`), o fluxo é:
  1. Faz backup de `backend/data` da **própria VPS** em `/tmp`.
  2. Dá `git reset --hard origin/stage` (código e arquivos vêm do repositório).
  3. **Restaura** o backup em `backend/data`.
- Ou seja: no stage, **sempre prevalece o que já estava na VPS** (backup), não o que está no Git na branch `stage`.
- Se em algum momento o stage ficou com `frases.json` vazio ou antigo, esse estado é “preservado” em todo deploy.
- Além disso, você tem alterações locais em `backend/data/frases.json` que **não estão commitadas**. Mesmo que faça merge para `stage`, o stage continua com o backup antigo até você forçar a atualização (veja abaixo).

### 2. **Não conseguir editar ou excluir frases no stage**

- Editar/excluir = o backend gravar em `backend/data/frases.json`.
- Se o processo do backend (ex.: systemd) rodar com um usuário que **não tem permissão de escrita** em `backend/data/`, as operações de escrita falham (e a lista pode até vir do cache/leitura).
- Outra possibilidade: diretório `backend/data` não existir na VPS após o restore (path errado ou restore falho).

## O que fazer

### Passo 1: Garantir que o stage use o mesmo `frases.json` que você quer

**Opção A – Usar o workflow “Sync Frases to Stage” (recomendado)**

1. **Commit e push** das suas alterações de frases para o repositório (pelo menos para a branch que o workflow usa no checkout, ex. `main` ou `stage`):
   ```bash
   git add backend/data/frases.json backend/data/patologias.json
   git commit -m "Atualizar frases para stage"
   git push origin <sua-branch>
   ```
2. Se o workflow fizer checkout da `stage`, faça merge da sua branch em `stage` e dê push.
3. No GitHub: **Actions** → workflow **“Sync Frases to Stage”** → **Run workflow**.
4. Isso copia `backend/data/frases.json` do **repositório** para a VPS e reinicia o backend. Assim o stage fica com as mesmas frases que estão no repo.

**Opção B – Não restaurar o backup de `data` em um deploy (usar só o que está no Git)**

- No `deploy-stage.yml`, comentar ou remover o bloco que restaura `/tmp/fortcordis_data_backup` em `backend/data/`.
- No próximo deploy, `backend/data` será exatamente o que está na branch `stage` (incluindo `frases.json` e `patologias.json`).
- Use isso só se aceitar que **qualquer alteração feita direto no stage** (se houver) será perdida no próximo deploy.

### Passo 2: Garantir que editar/excluir funcione no stage (permissões)

Na VPS, após o deploy (e após o restore de `backend/data`):

```bash
# Quem roda o backend (ex.: www-data ou o usuário do systemd)
sudo -u www-data id
# Ajuste o dono do diretório para esse usuário
sudo chown -R www-data:www-data /var/www/fortcordis-stage/backend/data
chmod -R u+rwX /var/www/fortcordis-stage/backend/data
```

(Substitua `www-data` pelo usuário que realmente executa o serviço `fortcordis-stage-backend`.)

Assim o backend consegue **escrever** em `frases.json` e `patologias.json`, e editar/excluir frases passa a funcionar no stage.

### Passo 3: Conferir após o próximo deploy

- Rodar o script de verificação (se existir) ou:
  - Abrir a aplicação de laudos no stage.
  - Listar frases, editar uma e excluir outra.
  - Se der erro, ver os logs do backend no stage (ex.: `journalctl -u fortcordis-stage-backend -f`) ao editar/excluir.

## Resumo

| Problema | Causa | Ação |
|----------|--------|------|
| Frases diferentes no stage | Backup de `backend/data` na VPS sobrescreve o que vem do Git; frases locais não commitadas não vão para o repo | Commitar/push `backend/data/frases.json`, merge em `stage`, rodar “Sync Frases to Stage” ou deixar de restaurar o backup de `data` no deploy |
| Não consegue editar/excluir no stage | Backend sem permissão de escrita em `backend/data/` na VPS | Ajustar dono/permissões de `/var/www/fortcordis-stage/backend/data` para o usuário do serviço |

Depois disso, os deploys passam a manter as frases alinhadas (via Sync ou via Git) e as operações de edição/exclusão passam a funcionar no stage.
