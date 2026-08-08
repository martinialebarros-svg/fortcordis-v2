# Spec - portal-clinica-agendamentos-ativos

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: draft (pendente de revisao)

## 1) Escopo funcional

No portal da clinica parceira, adicionar um bloco "Agendamentos ativos da unidade" que lista os
agendamentos da propria clinica com status Agendado/Reservado/Confirmado/Em atendimento, e
permite cancelar (com confirmacao) os que estao em Agendado/Reservado/Confirmado. Nao aparece no
modo de espelho administrativo (`admin_preview`).

## 2) Requisitos funcionais (RF)

- RF-001: `GET /api/v1/portal/clinicas/agendamentos` retorna os agendamentos da clinica da sessao
  (`portal_session.clinica_id`) com status em `{Agendado, Reservado, Confirmado, Em atendimento}`,
  ordenados por `inicio` ascendente, limitados a 200 itens.
- RF-002: Cada item retornado inclui `pode_cancelar` calculado no backend
  (`true` para Agendado/Reservado/Confirmado, `false` para Em atendimento).
- RF-003: `PATCH /api/v1/portal/clinicas/agendamentos/{id}/cancelar` cancela (status -> Cancelado)
  um agendamento da propria clinica, somente se o status atual estiver em
  `{Agendado, Reservado, Confirmado}`.
- RF-004: Tentar cancelar um agendamento de outra clinica retorna 404 (nao 403), para nao revelar
  a existencia do ID a quem nao tem acesso.
- RF-005: Tentar cancelar um agendamento fora do conjunto cancelavel (Em atendimento, Realizado,
  Cancelado, Faltou, Expirado) retorna 409 com mensagem orientando a contatar a Fort Cordis.
- RF-006: Cancelamento bem-sucedido registra: (a) evento de auditoria (`registrar_auditoria`,
  modulo `portal_clinica`, acao `cancelar`); (b) nota em `observacoes` do agendamento
  (`[Portal] Cancelado pela clinica parceira (<nome>) em <data/hora> UTC.`).
- RF-007: No frontend, o bloco so carrega/aparece quando a sessao e uma clinica real (nao
  `admin_preview`); tem botao "Atualizar" para recarregar sob demanda.
- RF-008: O botao "Cancelar" exige confirmacao inline (2 cliques) antes de chamar o endpoint.
- RF-009: Apos cancelar com sucesso, a lista e recarregada automaticamente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): `clinica_id` sempre resolvido a partir do
  `PortalSessionContext` (token), nunca de parametro do cliente — mesmo padrao usado em
  `listar_exames_clinica_portal`.
- NFR-002 (exposicao minima de dados): a resposta nao inclui `observacoes` internas do
  agendamento, nem nomes de usuarios internos (`criado_por_nome`/`confirmado_por_nome`), nem
  qualquer campo de `Transacao`/`ContaPagar`/`ContaReceber`.
- NFR-003 (concorrencia): cancelamento adquire `_adquirir_lock_escrita_agenda` (mesmo lock usado
  pelas escritas internas de agenda) antes de validar/alterar o status.
- NFR-004 (auditoria): toda chamada de cancelamento bem-sucedida gera evento de auditoria
  (best-effort, nao bloqueia a resposta se a auditoria falhar).

## 4) Contratos tecnicos

### API

- `GET /api/v1/portal/clinicas/agendamentos`
  - Auth: `PortalSessionContext` (`actor_type == "clinica"`, `clinica_id` presente e ativo).
  - Resposta: `PortalClinicaAgendamentoListResponse` (`total`, `clinica_id`, `clinica_nome`,
    `items: PortalClinicaAgendamentoItemResponse[]`).
- `PATCH /api/v1/portal/clinicas/agendamentos/{agendamento_id}/cancelar`
  - Auth: idem.
  - Resposta: `PortalClinicaAgendamentoCancelResponse` (`item`, `message`).
  - Erros: 403 (sessao sem clinica ativa), 404 (nao encontrado / de outra clinica), 409 (status
    nao cancelavel).

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma coluna nova. Leitura/escrita em `agendamentos` (existente) e
  `auditoria_eventos` (existente, via `registrar_auditoria`).
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: `frontend/components/portal/PortalClinicaWorkspace.tsx` (novo bloco), novas
  funcoes/tipos em `frontend/lib/portal-api.ts`
  (`listPortalClinicAgendamentos`, `cancelPortalClinicAgendamento`).
- Estados de UI: carregando / vazio / erro / confirmacao inline de cancelamento / mensagem de
  sucesso.
- Regras de exibicao: bloco oculto em `mode="admin_preview"`; botao "Cancelar" so aparece quando
  `pode_cancelar = true`.

## 5) Compatibilidade e rollout

- Backward compatibility: total; endpoints e bloco de UI sao aditivos, nao alteram contratos
  existentes de exames/laudos.
- Feature flag: nao ha. Dado que a intent.md desta feature ainda tem decisoes de escopo nao
  confirmadas pelo usuario (secao 7), **este spec fica em `draft` e o `verify.md` marca a
  liberacao para stage/producao como nao aprovada** at revisao humana.
- Estrategia de rollback: reverter os commits de backend/frontend; nenhuma migracao para desfazer.

## 6) Criterios de aceitacao (CA)

- CA-001: Clinica A ve, no portal, apenas os agendamentos com `clinica_id` dela, em status
  visivel; nao ve agendamentos da Clinica B.
- CA-002: Agendamento em "Em atendimento" aparece na lista mas sem botao de cancelar
  (`pode_cancelar = false`).
- CA-003: Cancelar um agendamento "Agendado"/"Reservado"/"Confirmado" da propria clinica muda o
  status para "Cancelado", registra auditoria e nota em `observacoes`, e some da lista de ativos
  na proxima atualizacao.
- CA-004: Tentar cancelar um agendamento de outra clinica retorna 404 e nao altera o registro.
- CA-005: Tentar cancelar um agendamento "Realizado" retorna 409 e nao altera o registro.
- CA-006: O bloco de agendamentos nao aparece quando a tela esta em modo `admin_preview`.

## 7) Casos de borda

- CB-001: Clinica sem nenhum agendamento ativo ve mensagem de lista vazia, sem erro.
- CB-002: Cancelamento concorrente (duplo clique) — o segundo clique encontra o agendamento ja
  fora do conjunto cancelavel e recebe 409 em vez de cancelar duas vezes.
- CB-003: Sessao expirada durante o uso do bloco — `ensureClinicSession` tenta renovar antes de
  chamar a API, mesmo padrao ja usado no carregamento de exames.

## 8) Fora de escopo

- Remarcar agendamento pelo portal.
- Cancelar agendamentos "Realizado"/"Em atendimento" pelo portal.
- Notificacao em tempo real para a agenda interna quando o cancelamento ocorre pelo portal.
- Suporte ao modo `admin_preview` para este bloco.
- Qualquer dado financeiro (ver `portal-clinica-financeiro-os`, ainda nao iniciada).
