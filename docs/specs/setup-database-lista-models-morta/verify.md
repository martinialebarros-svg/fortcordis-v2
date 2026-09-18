# Verify - setup-database-lista-models-morta

Data: 2026-09-18  
Responsavel: Martiniano Barros  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `grep -rn "MODELS" backend/` sem saida apos a mudanca (antes: 1 ocorrencia, a propria declaracao) | ok |
| CA-002 | aceitacao | dump de `sorted(Base.metadata.tables)` nas duas versoes: 99 antes, 99 depois, diff vazio nos dois sentidos | ok |
| CA-003 | aceitacao | `configuracoes` e `configuracoes_usuario` presentes no metadata e impressas como `✅` por `verificar_tabelas()` em banco novo | ok |
| CA-004 | aceitacao | `setup_database.py` executado contra SQLite vazio: `Tabelas criadas com sucesso`, `SETUP CONCLUIDO`, nenhuma `NÃO ENCONTRADA` | ok |
| CA-005 | aceitacao | `python -c "import app.main"` retorna `app.main OK` | ok |
| CA-006 | aceitacao | `pytest tests -q`: 1365 passed, 7 skipped, 290 subtests passed | ok |
| NFR-001 | nao funcional | conjunto de modulos carregados inalterado; `import app.models` ja ocorria antes | ok |
| NFR-003 | nao funcional | saida do script identica, incluindo o relatorio de `verificar_tabelas()` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend
grep -rn "MODELS" backend/
PYTHONPATH=. python -c "import app.main; print('app.main OK')"
DATABASE_URL="sqlite:///$SCRATCH/e2e.db" PYTHONPATH=. python setup_database.py
DATABASE_URL="sqlite:///$SCRATCH/e2e.db" PYTHONPATH=. python -m pytest tests -q
```

Paridade de metadata (comparacao entre a versao de `HEAD` e a alterada, cada
uma importada como modulo e seguida de `sorted(Base.metadata.tables)`):

```
antes=99 depois=99
perdidas: nenhuma
ganhas:   nenhuma
PARIDADE EXATA
```

Resumo dos resultados:
- Backend: suite completa verde (1365 passed, 7 skipped, 290 subtests).
  Execucao fim a fim de `setup_database.py` sem erro em banco vazio.
- Frontend: nao executado — a mudanca nao toca `frontend/`.

## 3) Testes manuais

- Cenario 1: primeira tentativa de remocao, tirando `MODELS` **e** todo o bloco
  `from app.models import (...)`. A comparacao de metadata acusou 99 -> 97, com
  `configuracoes` e `configuracoes_usuario` perdidas. Foi assim que o problema
  apareceu, antes de qualquer commit.
- Cenario 2: confirmado por `grep` em `migrations/versions/` que nenhuma
  migracao versionada cria `configuracoes` — as ocorrencias sao apenas
  `INSERT`/`UPDATE` de linhas. Logo `create_all` e o unico criador dessas duas
  tabelas, e a perda teria sido real em banco novo.
- Cenario 3: varredura de todos os submodulos de `app/models` mostrou cinco
  ausentes do `__init__.py` (`agenda_formalizacao`, `alerta_interno`,
  `configuracao`, `fiscal`, `whatsapp_bot`). Das 12 tabelas envolvidas, 10 sao
  criadas por migracao versionada; so as 2 de `configuracao` dependiam do
  import removido. Por isso apenas `configuracao` entrou no `__init__.py`.
- Cenario 4: confirmado que o SQLite local `backend/fortcordis.db` nao foi
  tocado — todos os testes usaram banco descartavel fora do repo.

## 4) Regressao e riscos residuais

- Risco residual 1: `agenda_formalizacao`, `alerta_interno`, `fiscal` e
  `whatsapp_bot` seguem fora de `app/models/__init__.py`. Nao ha bug em aberto
  (as 10 tabelas nascem por migracao versionada), mas a regra "modelo novo entra
  no `__init__.py`" tem quatro excecoes historicas. Vale uma decisao propria
  sobre padronizar ou documentar a convencao de que tabela nova vem por
  migracao.
- Risco residual 2: `tabelas_esperadas` em `verificar_tabelas()` cobre 37 das 99
  tabelas. E subverificacao, nao falso negativo; ficou fora de escopo e recebeu
  apenas um comentario explicando o que a lista e.

## 5) Itens fora de escopo entregues

- `app/models/__init__.py` ganhou o import de `configuracao`. Nao estava
  previsto no pedido original, mas sem ele a remocao do bloco de imports seria
  uma regressao: era a unica coisa que registrava `configuracoes` e
  `configuracoes_usuario`.
- Comentario de uma linha em `verificar_tabelas()` esclarecendo que
  `tabelas_esperadas` e smoke check de subconjunto, nao a fonte das tabelas —
  e a proxima lista que o mesmo leitor encontraria.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
