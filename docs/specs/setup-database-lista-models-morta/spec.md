# Spec - setup-database-lista-models-morta

Data: 2026-09-18  
Responsavel: Martiniano Barros  
Status: done

## 1) Escopo funcional

Remover a lista `MODELS` de `backend/setup_database.py` — codigo morto desde o
primeiro commit do arquivo — e substituir o bloco de imports que a alimentava
por um unico `import app.models`, com comentario dizendo qual e o mecanismo real
de criacao de tabelas (`Base.metadata.create_all`). Para que esse import unico
seja de fato equivalente, `app/models/__init__.py` passa a importar o submodulo
`configuracao`, hoje o unico registrado apenas pelo bloco removido. Sem mudanca
de comportamento: mesmo conjunto de tabelas, antes e depois.

## 2) Requisitos funcionais (RF)

- RF-001: `MODELS` deixa de existir em `backend/setup_database.py`.
- RF-002: o bloco `from app.models import (user, papel, ...)`, cujos nomes so
  eram usados por `MODELS`, da lugar a `import app.models  # noqa: F401`.
- RF-003: `app/models/__init__.py` importa `Configuracao` e
  `ConfiguracaoUsuario`, preservando o registro de `configuracoes` e
  `configuracoes_usuario` no metadata.
- RF-004: comentario no ponto do import explica que o registro vem de
  `app/models/__init__.py` e que nao ha lista de modelos a manter no script.
- RF-005: comentario em `verificar_tabelas()` marca `tabelas_esperadas` como
  smoke check de um subconjunto, nao como fonte das tabelas.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): sem efeito. O `import app.models` ja era executado
  pelo bloco anterior; o conjunto de modulos carregados nao muda.
- NFR-002 (seguranca/permissoes): sem superficie nova. O script nao expoe rota
  nem muda autenticacao.
- NFR-003 (observabilidade): a saida de `setup_database.py` permanece
  identica, inclusive o relatorio de `verificar_tabelas()`.

## 4) Contratos tecnicos

### API

- Endpoint: nao se aplica.
- Metodo: nao se aplica.
- Payload: nao se aplica.
- Resposta: nao se aplica.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma. O conjunto registrado em
  `Base.metadata` permanece com as mesmas 99 tabelas.
- Indices/constraints: inalterados.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: nenhuma.
- Estados de UI: nao se aplica.
- Regras de exibicao/erro: nao se aplica.

## 5) Compatibilidade e rollout

- Backward compatibility: total. Em banco ja provisionado, `create_all` e
  no-op para tabela existente; em banco novo, cria o mesmo conjunto de antes.
- Feature flag (se houver): nenhuma.
- Estrategia de rollback: `git revert` do commit. Nao ha estado persistido a
  desfazer.

## 6) Criterios de aceitacao (CA)

- CA-001: `grep -rn "MODELS" backend/` nao retorna nenhuma ocorrencia.
- CA-002: o conjunto de chaves de `Base.metadata.tables` apos importar
  `setup_database` e exatamente igual ao de antes da mudanca (99 tabelas,
  nenhuma perdida, nenhuma ganha).
- CA-003: `configuracoes` e `configuracoes_usuario` seguem no metadata e sao
  criadas em banco novo.
- CA-004: `backend/setup_database.py` roda fim a fim contra banco vazio sem
  erro, e `verificar_tabelas()` nao reporta nenhuma tabela faltante.
- CA-005: `app.main` continua importando (sem import circular vindo da nova
  linha em `app/models/__init__.py`).
- CA-006: a suite `backend/tests` permanece verde.

## 7) Casos de borda

- CB-001: banco novo, do zero — o caso em que a regressao apareceria. Coberto
  por CA-003 e CA-004.
- CB-002: banco ja existente (stage/producao) — `create_all` ignora tabela que
  ja existe; a mudanca e inerte.
- CB-003: import circular ao adicionar `configuracao` ao `__init__.py` —
  coberto por CA-005.

## 8) Fora de escopo

- Completar `tabelas_esperadas` em `verificar_tabelas()`. Ela tambem esta
  desatualizada (lista 37 de 99 tabelas), mas e uma lista **usada**: um
  subconjunto menor so verifica menos, nao quebra nada, e nao produz falso
  negativo. Aqui ela so ganha um comentario dizendo o que e.
- Padronizar os outros quatro submodulos ausentes de `app/models/__init__.py`
  (`agenda_formalizacao`, `alerta_interno`, `fiscal`, `whatsapp_bot`). As 10
  tabelas deles sao criadas por migracao versionada, entao nao ha bug em aberto;
  adiciona-los mudaria quem cria essas tabelas e merece decisao propria.
