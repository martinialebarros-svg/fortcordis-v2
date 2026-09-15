# Plan - agenda-reserva-mensagem-edicao

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel.
- Fase 3 (frontend): unica fase de implementacao.
- Fase 4 (integracao/observabilidade): nao aplicavel.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Exibir a secao de destinatario/WhatsApp tambem em modo de edicao quando o agendamento
      for uma reserva (`!isEditando || formData.marcar_como_reserva`).
- [x] T3.2 Ocultar, em modo de edicao, o checkbox "marcar como reserva" e os campos de prazo de
      confirmacao (permanecem exclusivos da criacao).
- [x] T3.3 Criar `gerarMensagemManualEdicao` (reaproveita `construirMensagemAgendaPosCriacao`) e o
      botao "Gerar mensagem de confirmacao", visivel apenas em edicao.
- [x] T3.4 Ajustar o fechamento da tela de mensagem (X e botao secundario) para voltar ao
      formulario em modo de edicao, em vez de fechar o modal.
- [x] T3.5 Adicionar aviso na tela de mensagem, em modo de edicao, lembrando de salvar alteracoes
      pendentes.
- Criterio de conclusao: os 5 CAs do `spec.md` validados (manual + verificacao estatica).
- Risco: baixo (isolado a um componente frontend, sem chamada de API nova).
- Rollback: reverter o commit do arquivo frontend.

## 3) Plano de testes

- Testes unitarios: nao ha suite de componente para este modal hoje; nao criada uma nova suite
  neste ciclo (ver `verify.md` para justificativa).
- Testes de integracao: nao aplicavel (sem mudanca de API).
- Testes manuais: os 5 cenarios de CA-001 a CA-005 — ver `verify.md`.

## 4) Dependencias e bloqueios

- Nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: verificacao estatica (tsc/eslint/vitest) + boot do dev server
      nesta sessao; QA manual com dados reais (login + agendamento "Reservado" existente) fica
      pendente para stage/local do responsavel, pois este ambiente nao tem backend/DB configurado.
