# Spec - agenda-assistente-governanca-for55

Data: 2026-05-23
Responsavel: Martiniano + Codex
Status: in-progress

## 1) Escopo funcional

Consolidar governanca operacional do assistente de agendamento com foco em:
- bloqueio de bypass no fluxo `sem_opcao`;
- autorizacao explicita de excecao por papel admin;
- protecao de concorrencia de slot;
- orquestracao unica de politica/oferta no backend;
- trilha auditavel de excecao concedida;
- telemetria do funil para operacao.

## 2) Requisitos funcionais (RF)

- RF-001: fluxo `sem_opcao` so pode ser concluido apos pelo menos 1 oferta exibida no panorama.
- RF-002: endpoint de encerramento do assistente deve rejeitar desfecho `sem agendamento` sem `total_sugestoes >= 1`.
- RF-003: somente admin pode alterar `agenda_excecoes` em configuracoes.
- RF-004: criacao/edicao/status de agendamento deve aplicar lock de escrita para reduzir corrida de double-booking.
- RF-005: para duas requisicoes simultaneas no mesmo slot, no maximo 1 agendamento deve persistir.
- RF-006: backend deve expor endpoint orquestrador unico de oferta com politica + proximidade + panorama em resposta unica.
- RF-007: frontend do modal deve usar o endpoint orquestrador no fluxo "Gerar melhor oferta".
- RF-008: concessao de excecao operacional por admin deve gerar evento estruturado dedicado de auditoria.
- RF-009: backend deve registrar eventos de funil do assistente para oferta gerada, aceite, sem opcao, solicitacao de excecao, excecao concedida e encerramento.
- RF-010: backend deve expor endpoint admin de metricas agregadas do funil por etapa, perfil, clinica e serie diaria.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): regras de permissao por papel devem ser reforcadas no backend, sem depender apenas da UI.
- NFR-002 (consistencia): mesma entrada de negocio deve produzir mesma decisao de data-base/politica em qualquer entrypoint de sugestao.
- NFR-003 (confiabilidade): fluxo de agendamento deve reduzir risco de duplicidade em concorrencia.
- NFR-004 (observabilidade): eventos do funil devem ser consultaveis por janela temporal para operacao.

## 4) Contratos tecnicos

### Backend

- Arquivo principal: `backend/app/api/v1/endpoints/agenda.py`.
- Endpoint novo: `POST /agenda/assistente/ofertas`.
  - Entrada: clinica, servico, data, data_contato, parametros de oferta/proximidade.
  - Saida: `politica_oferta`, `sugestao_proximidade`, `panorama_ofertas`, `data_base`, `origem_data_automatica`, `mensagem_panorama`.
- Endpoint novo: `GET /agenda/assistente/metricas` (admin).
  - Saida: `totais_por_etapa`, `por_perfil`, `por_clinica`, `serie_diaria`.
- Reforcos:
  - lock de escrita em create/update/status (`BEGIN IMMEDIATE` em SQLite e advisory lock no Postgres);
  - evento `ASSISTENTE_AGENDA_EXCECAO_CONCEDIDA`;
  - validacao de encerramento sem oferta exibida.

### Frontend

- Arquivo principal: `frontend/app/agenda/NovoAgendamentoModal.tsx`.
- Mudancas:
  - `Gerar melhor oferta` passa a consumir `POST /agenda/assistente/ofertas`;
  - mensagens e data-base passam a seguir retorno orquestrado do backend;
  - recusa `sem_opcao` sem oferta exibida segue bloqueada.

## 5) Compatibilidade e rollout

- Backward compatibility: endpoints antigos (`/agenda/sugestao-proximidade` e `/agenda/sugestoes-horario`) permanecem ativos.
- Rollout: deploy combinado backend + frontend, sem migracoes de schema.
- Rollback: revert do ciclo FOR-55/FOR-56/FOR-57/FOR-58/FOR-59/FOR-60/FOR-61.

## 6) Criterios de aceitacao (CA)

- CA-001: usuario nao conclui recusa `sem_opcao` sem oferta exibida.
- CA-002: `POST /agenda/assistente/encerramento` retorna 422 quando `total_sugestoes < 1`.
- CA-003: nao-admin recebe 403 ao alterar `agenda_excecoes`.
- CA-004: em teste concorrente de mesmo slot, apenas um agendamento e persistido.
- CA-005: endpoint orquestrador define `data_base` e `origem_data_automatica` de forma deterministica.
- CA-006: frontend usa resposta orquestrada para montar panorama e mensagem.
- CA-007: conceder excecao operacional por admin gera evento estruturado dedicado.
- CA-008: endpoint de metricas retorna agregacao por etapa, perfil e clinica no periodo informado.

## 7) Casos de borda

- CB-001: data passada deve retornar sem oferta sem quebrar funil.
- CB-002: chamada de encerramento com contexto invalido deve ser rejeitada.
- CB-003: concorrencia com duas threads simultaneas no mesmo slot.
- CB-004: politica distante/baixa frequencia sem ancora aderente em D+2 deve aplicar data preferencial de politica.

## 8) Fora de escopo

- Dashboard visual frontend de metricas (entrega atual cobre endpoint de dados).
- Mudanca estrutural de storage de auditoria para data warehouse.
