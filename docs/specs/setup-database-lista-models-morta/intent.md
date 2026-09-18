# Intent - setup-database-lista-models-morta

Data: 2026-09-18  
Responsavel: Martiniano Barros  
Status: done

## 1) Problema atual

`backend/setup_database.py` declara uma lista `MODELS` com ~37 classes de modelo
que **nunca e referenciada** — nem no arquivo, nem em qualquer outro ponto do
repo (`grep -rn "MODELS" backend/` retorna so a propria declaracao). Ela nasceu
morta: esta assim desde o primeiro commit do arquivo (`eb9a4f63`), e nenhuma
revisao intermediaria chegou a usa-la.

Quem cria as tabelas de fato e `Base.metadata.create_all(bind=engine)` dentro de
`criar_tabelas()`, que cobre todo modelo registrado no metadata pelos imports do
topo do arquivo.

A lista ja esta desatualizada e induz ao erro: os modelos de
`portal_clinic_auth` (`PortalClinicAccount`, `PortalClinicInvite`,
`PortalClinicSession`, ...) nao aparecem nela e mesmo assim tem tabela criada
normalmente. O comentario logo acima dela — `# Importar todos os modelos para o
Base.metadata` — reforca a leitura errada de que a lista e o que registra os
modelos. Um leitor futuro conclui que precisa adicionar modelo ali para que a
tabela seja criada. Foi exatamente a duvida levantada ao adicionar
`PortalClinicExamLink`.

## 2) Objetivo

Remover o codigo morto e deixar explicito, no proprio arquivo, qual e o
mecanismo real de criacao de tabelas — para que o proximo modelo entre no lugar
certo sem consulta a ninguem.

## 3) Nao objetivos

- Nao alterar o comportamento de `setup_database.py`: o conjunto de tabelas
  criadas tem de continuar identico.
- Nao mexer no runner de migracoes versionadas.
- Nao reescrever `verificar_tabelas()` nem completar sua lista
  `tabelas_esperadas` (ver "Fora de escopo" na spec).
- Nao alinhar os demais submodulos ausentes de `app/models/__init__.py`
  (ver risco residual em `verify.md`).

## 4) Contexto e restricoes

- `setup_database.py` roda em **todo deploy** de stage e producao
  (`scripts/deploy_prod_vps.sh`, `scripts/seed_stage_vps.sh`,
  `.github/workflows/fix-database.yml`). Qualquer regressao aqui aparece como
  tabela faltando em ambiente novo.
- Achado durante a execucao, que mudou o desenho da mudanca: o bloco
  `from app.models import (...)` do topo **nao** existia apenas para alimentar
  `MODELS`. O submodulo `configuracao` nao e importado por
  `app/models/__init__.py`, entao aquele import era o unico responsavel por
  registrar `configuracoes` e `configuracoes_usuario` no metadata. Nenhuma
  migracao versionada cria essas duas tabelas — `create_all` e o unico criador.
  Remover o import "porque so servia para a lista" teria sido uma regressao
  silenciosa em banco novo.

## 5) Impacto esperado

- Usuarios impactados: nenhum (script de setup/deploy, sem superficie de UI).
- Modulos impactados: `backend/setup_database.py`, `backend/app/models/__init__.py`.
- Risco de regressao: baixo, e coberto por comparacao direta do metadata
  antes/depois.

## 6) Riscos iniciais

- Risco 1: remover o import junto com a lista e derrubar o registro de algum
  modelo — **materializou-se** em `configuracao` e foi tratado antes do commit.
- Risco 2: adicionar `configuracao` a `app/models/__init__.py` criar import
  circular.

## 7) Perguntas abertas

- Vale padronizar que todo submodulo de modelo entre em
  `app/models/__init__.py`? Hoje cinco ficam de fora (`agenda_formalizacao`,
  `alerta_interno`, `configuracao`, `fiscal`, `whatsapp_bot`) e suas tabelas
  nascem por migracao versionada. Esta entrega resolve so `configuracao`, que
  era o caso sem migracao.

## 8) Definition of Ready (gate para spec)

- [x] Confirmado por `grep` que `MODELS` nao tem nenhum consumidor.
- [x] Confirmado no historico (`git log -p`) que nunca teve.
- [x] Confirmado que `create_all` e o mecanismo real.
- [x] Mapeado o que o import do topo registra alem da lista.
