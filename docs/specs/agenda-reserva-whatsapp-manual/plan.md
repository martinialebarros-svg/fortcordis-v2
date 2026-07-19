# Plan - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: hotfix-ready-for-stage

## 1) Sequencia de fases

- Fase 1 (SDD): registrar intencao, requisitos e limites do fluxo provisório.
- Fase 2 (frontend): adicionar configuracao da reserva e entrega manual pos-criacao.
- Fase 3 (qualidade): executar lint, build e revisao do diff.
- Fase 4 (verificacao): preencher rastreabilidade e riscos residuais.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar `intent.md`.
- [x] T1.2 Criar `spec.md` e `plan.md`.
- Criterio de conclusao: escopo manual e nao objetivos explicitos.
- Risco: confundir esta entrega com a futura automacao da Meta.
- Rollback: remover artefatos junto do codigo revertido.

### Fase 2

- [x] T2.1 Implementar formatacao da mensagem e link `wa.me`.
- [x] T2.2 Implementar campos e tela pos-criacao no modal.
- Criterio de conclusao: reserva criada oferece abrir/copiar mensagem.
- Risco: popup bloqueado; a abertura deve partir de clique explicito.
- Rollback: reverter componentes do fluxo manual.

### Fase 3

- [x] T3.1 Executar ESLint focado.
- [x] T3.2 Executar build do frontend.
- Criterio de conclusao: comandos finalizam sem erro.
- Risco: regressao de tipagem em componente grande.
- Rollback: corrigir tipos ou reverter a alteracao.

### Fase 4

- [x] T4.1 Atualizar `verify.md` com evidencias.
- [x] T4.2 Revisar `git diff --check` e escopo final.
- Criterio de conclusao: criterios rastreados e riscos residuais registrados.
- Risco: documentacao divergir do comportamento entregue.
- Rollback: alinhar documentacao antes de concluir.

## 3) Plano de testes

- Testes unitarios: validacao indireta de helpers pelo typecheck/build.
- Testes de integracao: criacao da reserva continua usando o endpoint existente.
- Testes manuais: destinatario clinica/tutor, telefone ausente, copiar e abrir WhatsApp.

## 4) Dependencias e bloqueios

- Dependencia 1: telefones cadastrados em clinicas/tutores.
- Dependencia 2: navegador permitir abertura do WhatsApp a partir de clique explicito.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).

## 6) Hotfix de persistencia em stage

- [x] Confirmar no VPS o schema e as constraints de `agendamentos`.
- [x] Identificar o sentinela `paciente_id=0` como incompatível com `fk_agenda_paciente`.
- [x] Persistir `NULL` em reservas sem paciente na criacao e edicao.
- [x] Executar regressao backend e qualidade local.
- [ ] Executar guardrail SDD apos o commit.
- [ ] Publicar e validar em stage.
