# Verify - laudo-phrase-library

Data: 2026-05-03  
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
| NFR-001 | compatibilidade | teste `test_normalize_adds_phrase_pathologies_and_order`. | ok |
| NFR-003 | resiliencia | testes verificam backups runtime em alteracoes. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
python3 -m unittest backend/tests/test_frases_ecocardiograma_estruturado_teste_service.py
python3 -m py_compile backend/app/api/v1/endpoints/frases_ecocardiograma_estruturado_teste.py backend/app/services/frases_ecocardiograma_estruturado_teste_service.py

cd frontend
npx tsc --noEmit
npm run lint
```

Resumo dos resultados:
- Backend: 9 testes passaram; `py_compile` passou.
- Frontend: TypeScript passou.
- Observacao: `npm run lint` global falhou em `frontend/public/sw.js` por erro preexistente `@next/next/no-assign-module-variable`, fora do escopo desta entrega.

## 3) Testes manuais

- Cenario 1: em stage, abrir novo laudo e confirmar aba Biblioteca.
- Cenario 2: editar frase com patologia/tag e confirmar persistencia apos recarregar.
- Cenario 3: desativar/restaurar frase e confirmar aviso em preset que a utiliza.
- Cenario 4: aplicar preset na aba Qualitativa apos alteracao da Biblioteca.

## 4) Regressao e riscos residuais

- Risco residual 1: validacao visual completa depende do deploy stage concluir.
- Risco residual 2: a primeira normalizacao adiciona campos ao JSON runtime; backups sao preservados pelo servico.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
