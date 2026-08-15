# Plan - atendimento-documentos-auditoria

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel - reusa `AuditoriaEvento` existente.
- Fase 2 (backend/API): auditoria no service + endpoints atualizados.
- Fase 3 (frontend): nao aplicavel.
- Fase 4 (integracao/observabilidade): testes novos.

## 2) Tarefas por fase

### Fase 2

- [x] T2.1 - `document_crud_service.py`: `_snapshot_documento` +
  `_CAMPOS_DOCUMENTO_AUDITAVEIS`.
- [x] T2.2 - `atualizar_documento_atendimento`: captura snapshot antes,
  compara depois, registra auditoria condicional.
- [x] T2.3 - `excluir_documento_atendimento`: captura snapshot antes do
  delete, registra auditoria incondicional.
- [x] T2.4 - `atendimento.py`: os dois endpoints ganham `request: Request`,
  parem de descartar `current_user`, repassam ambos ao service.
- Criterio de conclusao: os testes de T4.1 passam.
- Risco: nenhum chamador direto das funcoes de service alem dos proprios
  endpoints (confirmado por grep antes de mudar a assinatura).
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - `test_atendimento_documentos_auditoria.py` (3 testes:
  atualizar com mudanca, atualizar sem mudanca, excluir).
- [x] T4.2 - Suite completa do backend.
- Criterio de conclusao: 673/673 (era 670 apos o pacote anterior, +3 deste).
- Risco: nenhum.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: 3 testes novos, chamando as funcoes de service
  diretamente com `patch.object(document_crud_service, "registrar_auditoria")`
  para inspecionar os argumentos exatos passados.
- Testes de integracao: suite completa do backend.
- Testes manuais: nao aplicavel - auditoria e um efeito colateral
  deterministico (grava uma linha com valores especificos), totalmente
  verificavel por teste automatizado.

## 4) Dependencias e bloqueios

- Dependencia 1: `registrar_auditoria` (ja existente).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest).
