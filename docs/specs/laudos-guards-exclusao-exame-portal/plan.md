# Plan - laudos-guards-exclusao-exame-portal

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel - nenhuma alteracao de schema.
- Fase 2 (backend/API): importar guards de `atendimento.py` em `laudos.py`
  e aplica-los em `atualizar_exame`, `deletar_exame`, `deletar_laudo`.
- Fase 3 (frontend): nao aplicavel.
- Fase 4 (integracao/observabilidade): auditoria das novas acoes.

## 2) Tarefas por fase

### Fase 1

N/A.

### Fase 2

- [x] T2.1 - Import de `_excluir_anexos_por_exame`,
  `_motivo_bloqueio_exclusao_exame`, `revogar_liberacao_exame_no_portal` de
  `atendimento.py` em `laudos.py`.
- [x] T2.2 - `atualizar_exame`: ignora `atendimento_id`/`id`; guard de
  `laudo_id` por paciente (ja existia, mantido); guard novo de status de
  liberacao direta.
- [x] T2.3 - `deletar_exame`: aplica `_motivo_bloqueio_exclusao_exame` e
  `_excluir_anexos_por_exame` antes do delete.
- [x] T2.4 - `deletar_laudo`: busca exames vinculados, revoga liberacao de
  portal onde aplicavel, so depois zera `laudo_id`.
- Criterio de conclusao: `test_laudos_exame_exclusao_guard.py`,
  `test_laudo_portal_release.py` (caso novo) e
  `test_laudos_exame_laudo_id_propriedade.py` (ajustado para `request=` e
  mock de auditoria) passam.
- Risco: assinatura de `atualizar_exame`/`deletar_exame` ganhou `request`
  obrigatorio - mitigado verificando todos os chamadores diretos no
  codebase (so os testes, todos atualizados).
- Rollback: reverter o commit restaura o comportamento anterior sem
  guards.

### Fase 3

N/A.

### Fase 4

- [x] T4.1 - `registrar_auditoria` em `atualizar_exame` (`EXAME_ATUALIZADO`)
  e `deletar_exame` (`EXAME_EXCLUIDO`).
- Criterio de conclusao: auditoria aparece nos testes (mockada onde o teste
  nao quer validar o conteudo, verificada onde o teste e sobre auditoria).
- Risco: nenhum.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: `test_laudos_exame_exclusao_guard.py` (7 testes: ignora
  atendimento_id, ignora liberacao direta, permite outras transicoes e
  audita, bloqueia delete com anexo/laudo/portal, exclui e audita sem
  bloqueio), `test_laudo_portal_release.py` (1 teste novo: deletar laudo
  revoga portal), `test_laudos_exame_laudo_id_propriedade.py` (2 testes
  existentes, ajustados para a nova assinatura).
- Testes de integracao: suite completa do backend.
- Testes manuais: nenhum necessario - guards sao os mesmos ja validados
  manualmente quando a feature original (`atendimento-integridade-prontuario`)
  foi promovida.

## 4) Dependencias e bloqueios

- Dependencia 1: guards `_motivo_bloqueio_exclusao_exame` e
  `revogar_liberacao_exame_no_portal` ja commitados em `atendimento.py`
  (feature `atendimento-integridade-prontuario`, commit 3f74a4b6) - esta
  feature nao redefine, apenas importa.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest).
