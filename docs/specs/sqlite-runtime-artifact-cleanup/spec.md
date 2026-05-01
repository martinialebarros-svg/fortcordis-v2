# Spec - sqlite-runtime-artifact-cleanup

Data: 2026-04-30  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Remover `backend/fortcordis.db` do indice Git e reforcar `.gitignore` para artefatos locais de runtime, mantendo a copia local do arquivo no disco de cada ambiente.

## 2) Requisitos funcionais (RF)

- RF-001: remover `backend/fortcordis.db` do versionamento.
- RF-002: manter `backend/fortcordis.db` ignorado por `.gitignore`.
- RF-003: ignorar uploads locais e backups runtime gerados pela aplicacao.
- RF-004: ignorar chaves `.pem` geradas localmente no backend.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): evitar commit acidental de dados locais/sensiveis.
- NFR-002 (operacao): nao apagar o SQLite existente da VPS/local.
- NFR-003 (deploy): manter compatibilidade com scripts que preservam runtime artifacts.

## 4) Contratos tecnicos

### Banco/migracoes

- Nenhuma migracao de schema.
- Mudanca de versionamento: `git rm --cached backend/fortcordis.db`.

### API

- Sem alteracao de endpoints.

### Frontend

- Sem alteracao.

## 5) Compatibilidade e rollout

- Rollout: stage primeiro; main apos validacao basica do deploy.
- Backward compatibility: ambientes com arquivo runtime local continuam usando sua copia local se configurados para SQLite.
- Rollback: restaurar o arquivo no Git a partir de commit anterior, se realmente necessario.

## 6) Criterios de aceitacao (CA)

- CA-001: `backend/fortcordis.db` nao aparece mais em `git ls-files`.
- CA-002: `.gitignore` cobre DBs, uploads, backups runtime e chaves `.pem`.
- CA-003: `git status` nao mostra esses artefatos como untracked apos a mudanca.
- CA-004: deploy stage/prod continua preservando `backend/fortcordis.db` runtime quando existir.

## 7) Casos de borda

- CB-001: ambiente sem `DATABASE_URL` e sem SQLite runtime.
- CB-002: testes antigos que assumam banco versionado.
- CB-003: arquivos ja rastreados continuam exigindo remocao explicita do indice Git.

## 8) Fora de escopo

- Criacao de seed local completo.
- Backup/restore de dados reais de producao.
- Alteracao da estrategia Supabase/PostgreSQL.
