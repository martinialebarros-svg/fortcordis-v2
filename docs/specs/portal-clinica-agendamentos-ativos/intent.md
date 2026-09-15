# Intent - portal-clinica-agendamentos-ativos

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: draft (pendente de revisao — ver secao 7)

## 1) Problema atual

O portal da clinica parceira (`frontend/app/clinica-parceira`, `PortalClinicaWorkspace.tsx`)
so mostra exames/laudos liberados. A clinica nao tem nenhuma visibilidade dos agendamentos
que ela mesma marcou com a Fort Cordis, nem forma de cancelar um agendamento sem ligar/mandar
mensagem para a secretaria.

## 2) Objetivo

Mostrar, no portal da clinica, os agendamentos ativos daquela unidade (agendado, reservado,
confirmado, em atendimento) e permitir que a propria clinica cancele um agendamento que ainda
nao foi realizado — reduzindo trabalho manual da secretaria para casos simples de cancelamento.

## 3) Nao objetivos

- Reagendar (mudar data/hora) pelo portal — fica para uma iteracao futura, se necessario.
- Cancelar agendamentos ja "Realizado" ou "Em atendimento" (ver riscos) — so a equipe interna
  pode desfazer esses casos, pelo modulo Atendimento/Agenda.
- Mostrar dados financeiros (isso e outra ideia, `portal-clinica-financeiro-os`, ainda nao
  iniciada — ver `NEXT_STEPS.md`).
- Suportar o modo `admin_preview` (espelho interno da equipe) — o novo bloco so aparece na
  sessao real da clinica, nao no espelho administrativo.
- Notificacao em tempo real para a agenda interna quando a clinica cancela (a equipe ve a
  mudanca no proximo carregamento/atualizacao da agenda, nao instantaneamente).

## 4) Contexto e restricoes

- Autenticacao: reaproveita o `PortalSessionContext` (JWT de sessao do portal) ja usado pelos
  endpoints de exames — mesmo padrao de escopo por `clinica_id` derivado do token (nunca de
  parametro do cliente).
- `Agendamento` (`backend/app/models/agendamento.py`) nao tem relacionamento ORM (FK) com
  Paciente/Tutor/Servico "de proposito" (comentario no modelo); a listagem usa os campos
  denormalizados (`paciente`, `tutor`, `servico`) ja mantidos em sincronia pelo fluxo interno de
  agenda, em vez de fazer joins novos.
- Cancelamento reaproveita `_adquirir_lock_escrita_agenda` de `agenda.py` (lock de escrita da
  agenda) para nao correr com edicoes concorrentes feitas pela equipe interna.

## 5) Impacto esperado

- Usuarios impactados: clinicas parceiras (portal externo) e, indiretamente, secretaria/equipe
  interna (menos pedidos manuais de cancelamento).
- Modulos impactados: `backend/app/api/v1/endpoints/portal.py`, `backend/app/schemas/portal.py`,
  `frontend/components/portal/PortalClinicaWorkspace.tsx`, `frontend/lib/portal-api.ts`.
- Risco de regressao: baixo para exames/laudos (nao alterados); risco novo e especifico ao
  cancelamento (ver riscos abaixo).

## 6) Riscos iniciais

- **Cancelamento indevido de atendimento em andamento**: mitigado restringindo cancelamento a
  status pre-"Realizado" (Agendado/Reservado/Confirmado); "Em atendimento" e "Realizado" ficam
  fora do conjunto cancelavel (`AGENDA_PORTAL_STATUSES_CANCELAVEIS`).
- **Vazamento de dados entre clinicas**: mitigado filtrando sempre por `clinica_id` vindo do
  token de sessao (nunca aceito como parametro), e retornando 404 (nao 403) ao tentar cancelar
  agendamento de outra clinica, para nao confirmar a existencia do ID a quem nao deveria ver.
- **Cancelamento em massa/abuso**: nao ha rate-limit dedicado nesta entrega — mesmo padrao dos
  demais endpoints do portal (protegidos por autenticacao, sem rate-limit especifico ainda).
- **Falta de rastreabilidade**: mitigado registrando auditoria (`registrar_auditoria`, modulo
  `portal_clinica`) e uma nota em `observacoes` do agendamento (`[Portal] Cancelado pela clinica
  parceira ...`).

## 7) Perguntas abertas / decisoes assumidas sem confirmacao explicita

O usuario nao respondeu as perguntas de escopo feitas antes desta implementacao (duas rodadas de
`AskUserQuestion` sem resposta). Segui com as opcoes que eu mesmo recomendei, registradas aqui
para revisao antes de ir para stage/producao:

- Cancelamento permitido apenas para Agendado/Reservado/Confirmado (nao para Realizado/Em
  atendimento). **Assumido, nao confirmado.**
- Escopo desta entrega e so visualizar + cancelar (sem remarcar). **Assumido, nao confirmado.**
- Nenhuma outra acao ("entre outras") foi especificada pelo usuario alem de cancelar.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
- [ ] Decisoes da secao 7 confirmadas pelo usuario (pendente).
