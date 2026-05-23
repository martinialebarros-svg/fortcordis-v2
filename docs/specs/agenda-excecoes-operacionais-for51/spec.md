# Spec - agenda-excecoes-operacionais-for51

Data: 2026-05-21
Responsavel: Martiniano + Codex
Status: in-progress

## 1) Escopo funcional

Fechar o ramo de excecao do assistente guiado de agendamento com permissao por papel, motivo obrigatorio e persistencia estruturada de encerramento sem agendamento.

## 2) Requisitos funcionais (RF)

- RF-001: quando o fluxo entrar em `sem_opcao`, o modal deve exigir motivo antes de concluir o desfecho.
- RF-002: usuario nao-admin nao pode liberar ajuste manual de data/hora no wizard; deve apenas solicitar excecao ao admin ou encerrar sem agendamento.
- RF-003: usuario admin pode conceder excecao explicitamente no wizard para liberar data/hora manual.
- RF-004: wizard deve oferecer acao explicita para registrar `solicitacao_excecao` e encerrar sem agendamento.
- RF-005: wizard deve oferecer acao explicita para registrar `encerramento_sem_agendamento` com motivo estruturado.
- RF-006: endpoint `POST /agenda/assistente/encerramento` deve persistir trilha estruturada via auditoria para os dois desfechos (`solicitacao_excecao`, `encerramento_sem_agendamento`).
- RF-007: quando admin conceder excecao e concluir salvamento manual, o agendamento deve registrar evidencias textuais da concessao nas observacoes.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): permissoes por papel devem ser respeitadas no frontend e reforcadas no fluxo de submit.
- NFR-002 (auditabilidade): motivo, tipo de desfecho, contexto do wizard e perfil do usuario devem ficar persistidos no evento de auditoria.
- NFR-003 (ux operacional): mensagens do assistente devem ser claras para secretarias sobre quando solicitar admin, conceder excecao ou encerrar.

## 4) Contratos tecnicos

### Frontend

- Arquivo principal: `frontend/app/agenda/NovoAgendamentoModal.tsx`.
- Entradas novas:
  - prop `isAdmin` para controlar ramo de excecao por papel.
  - estado `excecaoConcedida` para liberar manual somente em admin.
- Comportamento:
  - data/hora manuais bloqueadas por padrao no modo novo.
  - liberacao manual somente em `sem_opcao` + `admin` + concessao explicita.
  - acoes de desfecho chamam backend para persistencia estruturada.

### Backend

- Arquivo: `backend/app/api/v1/endpoints/agenda.py`.
- Endpoint novo: `POST /agenda/assistente/encerramento`.
- Payload:
  - `tipo`: `solicitacao_excecao` | `encerramento_sem_agendamento`
  - `motivo` (obrigatorio)
  - `clinica_id`, `servico_id`, `data_referencia`, `data_contato`, `contexto` (opcionais)
- Persistencia:
  - trilha em `auditoria_eventos` via `registrar_auditoria` com `detalhes` estruturado.

## 5) Compatibilidade e rollout

- Backward compatibility: `Editar Agendamento` permanece sem obrigatoriedade de wizard.
- Rollout: deploy combinado frontend + backend, sem migracoes.
- Rollback: revert do commit FOR-51.

## 6) Criterios de aceitacao (CA)

- CA-001: em `sem_opcao`, motivo obrigatorio para qualquer desfecho.
- CA-002: nao-admin nao consegue salvar agendamento manual apos recusa das ofertas.
- CA-003: admin consegue conceder excecao e, so entao, liberar data/hora manual para salvar.
- CA-004: acao `Solicitar excecao ao admin e encerrar` persiste evento estruturado de solicitacao.
- CA-005: acao `Encerrar sem agendamento` persiste evento estruturado de encerramento.
- CA-006: submit do modo novo bloqueia salvar manual se nao houver concessao admin no ramo `sem_opcao`.
- CA-007: observacoes do agendamento registram trilha de excecao concedida quando aplicavel.

## 7) Casos de borda

- CB-001: motivo com apenas espacos deve ser rejeitado.
- CB-002: data_referencia/data_contato fora de `YYYY-MM-DD` devem retornar 422 no endpoint.
- CB-003: sem clinica/servico informados, endpoint ainda registra desfecho com campos opcionais nulos.

## 8) Fora de escopo

- Motor de aprovacao com fila e SLA de solicitacoes de excecao.
- Notificacao push/whatsapp automatica para admins quando secretaria solicitar excecao.
