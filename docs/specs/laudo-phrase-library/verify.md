# Verify - laudo-phrase-library

Data: 2026-05-21  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/app/laudos/novo/page.tsx` e `frontend/app/laudos/[id]/editar/page.tsx` adicionam aba `biblioteca`. | ok |
| CA-002 | aceitacao | `EcocardiogramaEstruturadoBiblioteca.tsx` agrupa frases por patologias e usa grupo `Sem patologia`. | ok |
| CA-003 | aceitacao | formulario de frase salva `patologias`, `tags`, `ordem`, `aspecto`, `titulo`, `texto` e `ativo`. | ok |
| CA-004 | aceitacao | testes `test_renaming_phrase_updates_preset_reference_title` e `test_moving_phrase_updates_preset_selection_aspect`. | ok |
| CA-005 | aceitacao | endpoints e testes cobrem soft delete/restauracao de frases e presets. | ok |
| CA-006 | aceitacao | UI de presets mostra aviso `usa frase inativa`. | ok |
| CA-007 | aceitacao | teste `test_minimal_store_is_auto_recovered_from_rich_runtime_backup`. | ok |
| CA-008 | aceitacao | teste `test_save_blocks_unexpected_store_shrink`. | ok |
| NFR-001 | compatibilidade | teste `test_normalize_adds_phrase_pathologies_and_order`. | ok |
| NFR-003 | resiliencia | testes verificam backups runtime em alteracoes. | ok |
| NFR-004 | integridade | guarda de persistencia no `_save_store` bloqueia shrink acidental fora de `import/recovery`. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
venv/bin/python -m pytest tests/test_frases_ecocardiograma_estruturado_teste_service.py tests/test_frases_ecocardiograma_estruturado_import.py
venv/bin/python -m py_compile app/api/v1/endpoints/frases_ecocardiograma_estruturado_teste.py app/services/frases_ecocardiograma_estruturado_teste_service.py
venv/bin/python -m py_compile sync_frases_store.py

```

Resumo dos resultados:
- Backend: 12 testes passaram; `py_compile` passou.
- Frontend: sem alteracoes nesta correção.

## 3) Testes manuais

- Cenario 1: em stage, abrir novo laudo e confirmar aba Biblioteca.
- Cenario 2: editar frase com patologia/tag e confirmar persistencia apos recarregar.
- Cenario 3: desativar/restaurar frase e confirmar aviso em preset que a utiliza.
- Cenario 4: aplicar preset na aba Qualitativa apos alteracao da Biblioteca.

## 4) Regressao e riscos residuais

- Risco residual 1: validacao visual completa depende do deploy stage concluir.
- Risco residual 2: a primeira normalizacao adiciona campos ao JSON runtime; backups sao preservados pelo servico.
- Risco residual 3: autorecovery depende da existencia de backup runtime valido e mais rico no ambiente.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
