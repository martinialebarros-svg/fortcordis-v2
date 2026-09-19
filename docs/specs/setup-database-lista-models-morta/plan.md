# Plan - setup-database-lista-models-morta

Data: 2026-09-18  
Responsavel: Martiniano Barros  
Status: done

## 1) Sequencia de fases

- Fase 1 (investigacao): provar que `MODELS` e morta e medir o que o import do
  topo registra de fato.
- Fase 2 (backend): remover a lista, trocar o import, corrigir o
  `app/models/__init__.py`.
- Fase 3 (frontend): nao se aplica.
- Fase 4 (verificacao): paridade de metadata, execucao fim a fim e suite.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `grep -rn "MODELS" backend/` — confirmar consumidor unico (nenhum).
- [x] T1.2 `git log -p backend/setup_database.py` — confirmar que nasceu morta
      no commit `eb9a4f63` e nunca foi usada.
- [x] T1.3 Comparar os submodulos do import do topo com o que
      `app/models/__init__.py` importa.
- Criterio de conclusao: saber exatamente o que se perde ao remover o import.
- Risco: concluir cedo demais que o import so alimentava a lista.
- Rollback: nao se aplica (somente leitura).

### Fase 2

- [x] T2.1 Remover `MODELS` e o comentario enganoso acima dela.
- [x] T2.2 Trocar `from app.models import (...)` por `import app.models`, com
      comentario explicando o mecanismo real.
- [x] T2.3 Adicionar `from app.models.configuracao import Configuracao,
      ConfiguracaoUsuario` a `app/models/__init__.py`.
- [x] T2.4 Comentar `tabelas_esperadas` como smoke check de subconjunto.
- Criterio de conclusao: arquivo sem lista morta e sem perda de registro.
- Risco: perder silenciosamente o registro de algum modelo.
- Rollback: `git revert` do commit.

### Fase 3

- [x] T3.1 Nao se aplica — mudanca nao toca `frontend/`.
- Criterio de conclusao: nao se aplica.
- Risco: nenhum.
- Rollback: nao se aplica.

### Fase 4

- [x] T4.1 Dump de `sorted(Base.metadata.tables)` nas duas versoes e diff.
- [x] T4.2 Rodar `setup_database.py` contra SQLite descartavel.
- [x] T4.3 Importar `app.main` e rodar `pytest tests`.
- Criterio de conclusao: paridade exata e suite verde.
- Risco: ambiente local sem dependencias — resolvido usando a venv do clone
  principal em modo leitura.
- Rollback: `git revert` do commit.

## 3) Plano de testes

- Testes unitarios: `backend/tests` completo.
- Testes de integracao: execucao real de `setup_database.py` contra banco
  SQLite vazio em diretorio descartavel.
- Testes manuais: diff do conjunto de tabelas do metadata entre a versao em
  `HEAD` e a versao alterada.

## 4) Dependencias e bloqueios

- Dependencia 1: interpretador com `sqlalchemy`/`fastapi` — usada a venv de
  `backend/venv` do clone principal, sem escrita.
- Dependencia 2: nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (SQLite descartavel em scratchpad).
