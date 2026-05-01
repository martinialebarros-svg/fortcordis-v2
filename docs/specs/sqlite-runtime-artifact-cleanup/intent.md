# Intent - sqlite-runtime-artifact-cleanup

Data: 2026-04-30  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O arquivo `backend/fortcordis.db` e um banco SQLite local/fallback, mas esta versionado no Git. Isso cria risco de confundir dados locais com dados reais de stage/producao e gera diffs binarios impossiveis de revisar.

## 2) Objetivo

Remover o SQLite local do versionamento, mantendo o arquivo disponivel apenas no disco de cada ambiente quando necessario.

## 3) Nao objetivos

- Nao alterar `DATABASE_URL` de stage ou producao.
- Nao migrar dados do SQLite para Supabase.
- Nao remover backups runtime da VPS.

## 4) Contexto e restricoes

- Producao deve usar Supabase/PostgreSQL via `DATABASE_URL`.
- O deploy ja preserva/restaura `backend/fortcordis.db` como artefato runtime quando ele existir na VPS.
- Arquivos de upload e backups runtime tambem nao devem entrar no Git.

## 5) Impacto esperado

- Menos risco de subir dados locais por acidente.
- `git status` fica mais limpo.
- Dados locais continuam locais.

## 6) Riscos iniciais

- Risco 1: algum ambiente mal configurado sem `DATABASE_URL` depender do SQLite versionado.
- Risco 2: remocao do arquivo do repo expor dependencia oculta em testes antigos.

## 7) Perguntas abertas

- Futuramente devemos criar um seed local explicito para substituir o SQLite versionado.

## 8) Definition of Ready

- [x] Confirmado que prod real usa dados muito maiores que o SQLite local.
- [x] Confirmado que o deploy preserva o SQLite runtime.
- [x] Confirmado que `.gitignore` ja ignora `*.db`.
