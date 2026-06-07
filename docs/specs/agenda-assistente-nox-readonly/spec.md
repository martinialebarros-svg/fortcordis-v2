# Spec - agenda-assistente-nox-readonly

Data: 2026-06-07
Responsavel: Martiniano + Codex
Status: in-progress

## 1) Escopo funcional

Criar um contrato backend para assistentes externos autorizados consultarem o contexto operacional da agenda em modo read-only, sem autenticar como usuario humano e sem receber dados pessoais desnecessarios.

## 2) Requisitos funcionais

- RF-001: endpoint `GET /api/v1/agenda/assistente/contexto` deve exigir token dedicado em `X-Assistente-Agenda-Token` ou `Authorization: Bearer`.
- RF-002: token deve vir de `ASSISTENTE_AGENDA_TOKEN`; quando ausente ou curto, a integracao fica desabilitada.
- RF-003: consulta deve aceitar `data_inicio`, `data_fim`, `status`, `clinica_id`, `servico_id`, `limit` e `incluir_paciente`.
- RF-004: janela de consulta deve respeitar `ASSISTENTE_AGENDA_MAX_WINDOW_DAYS`, com teto duro de 31 dias.
- RF-005: payload de agenda deve retornar apenas ocupacao operacional: id do agendamento, data, inicio, fim, duracao, status, clinica e servico.
- RF-006: `incluir_paciente=true` deve retornar apenas primeiro nome do paciente, sem tutor, telefone ou observacoes.
- RF-007: resposta deve incluir catalogos minimos de clinicas/servicos ativos e regras normalizadas de funcionamento, rota e politica de oferta.
- RF-008: resposta deve explicitar contrato read-only, acoes permitidas e acoes bloqueadas para o assistente.

## 3) Requisitos nao funcionais

- NFR-001 (privacidade): nao retornar telefone, tutor, observacoes, laudos, financeiro nem dados completos do paciente.
- NFR-002 (seguranca): usar token separado da sessao web do usuario e comparar em tempo constante.
- NFR-003 (minimizacao): limitar periodo e quantidade de registros por chamada.
- NFR-004 (consistencia): reutilizar as mesmas regras carregadas por `agenda_config` e `agenda_route_rules`.

## 4) Contrato tecnico

### Endpoint

`GET /api/v1/agenda/assistente/contexto`

Headers:

- `X-Assistente-Agenda-Token: <token>`
- ou `Authorization: Bearer <token>`

Query params:

- `data_inicio`: data inicial no formato `YYYY-MM-DD`.
- `data_fim`: data final no formato `YYYY-MM-DD`.
- `status`: status permitido da agenda.
- `clinica_id`: filtro opcional de clinica.
- `servico_id`: filtro opcional de servico.
- `incluir_paciente`: booleano; por padrao `false`.
- `limit`: limite de itens, com teto de 500.

Variaveis:

- `ASSISTENTE_AGENDA_TOKEN`: token longo para habilitar a integracao.
- `ASSISTENTE_AGENDA_MAX_WINDOW_DAYS`: janela maxima configuravel, padrao 14, teto 31.

## 5) Fora de escopo

- Criar, editar, cancelar ou confirmar agendamentos por assistente externo.
- Expor dados de contato de tutor ou prontuario.
- Substituir o endpoint orquestrador do assistente guiado.
