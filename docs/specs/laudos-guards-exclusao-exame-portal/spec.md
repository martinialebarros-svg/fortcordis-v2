# Spec - laudos-guards-exclusao-exame-portal

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`PUT /exames/{id}` e `DELETE /exames/{id}` (laudos.py) passam a aplicar os
mesmos guards de `_sync_exames`/`_excluir_anexos_por_exame` de
`atendimento.py`. `DELETE /laudos/{id}` passa a revogar a liberacao no
portal de qualquer Exame vinculado antes de desvincular o `laudo_id`.

## 2) Requisitos funcionais (RF)

- RF-001: `PUT /exames/{id}` ignora silenciosamente os campos
  `atendimento_id` e `id` no payload (essa rota generica nao tem o contexto
  de guards que `_sync_exames` aplica ao vincular exame a atendimento - so
  o modulo de Atendimento pode fazer esse vinculo).
- RF-002: `PUT /exames/{id}` so aceita `laudo_id` que pertenca ao mesmo
  paciente do exame (mesma protecao de `_sync_exames`); `laudo_id` de outro
  paciente e silenciosamente ignorado (nao gera erro, mantem o valor
  anterior).
- RF-003: `PUT /exames/{id}` ignora tentativa de setar `status` para o
  valor de liberacao de portal diretamente - liberacao so pode ocorrer pelo
  endpoint dedicado (que valida PDF, preserva observacoes originais e
  audita a acao).
- RF-004: `PUT /exames/{id}` registra auditoria `EXAME_ATUALIZADO` com os
  campos efetivamente alterados.
- RF-005: `DELETE /exames/{id}` aplica `_motivo_bloqueio_exclusao_exame`
  (mesmo guard usado em `_sync_exames`): bloqueia com 409 se o exame tiver
  laudo vinculado, anexos, ou estiver liberado no portal.
- RF-006: `DELETE /exames/{id}` sem bloqueio remove os anexos do exame
  (mesma funcao `_excluir_anexos_por_exame` de atendimento.py) e registra
  auditoria `EXAME_EXCLUIDO`.
- RF-007: `DELETE /laudos/{id}` busca todo Exame com `laudo_id` apontando
  para o laudo; para cada um que estiver com status de liberacao de portal,
  chama `revogar_liberacao_exame_no_portal` antes de zerar `laudo_id`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): elimina o vazamento cruzado de
  laudo_id entre pacientes/clinicas via a rota generica de laudos.py.
- NFR-002 (observabilidade): update e delete de exame pela tela de Laudos
  passam a ser auditados (antes, delete de exame em laudos.py nao tinha
  nenhuma auditoria).
- NFR-003 (consistencia): nenhuma logica de guard e duplicada -
  `laudos.py` importa e reusa exatamente as mesmas funcoes que
  `atendimento.py` ja usa e ja tem cobertura de teste.

## 4) Contratos tecnicos

### API

- `PUT /exames/{exame_id}`: request inalterado (`dict` livre); `id` e
  `atendimento_id` no corpo passam a ser ignorados; `laudo_id`/`status`
  invalidos sao ignorados (nao geram erro, apenas nao aplicam a mudanca).
- `DELETE /exames/{exame_id}`: agora pode retornar 409 com mensagem do
  motivo de bloqueio (antes sempre excluia sem checagem).
- `DELETE /laudos/{laudo_id}`: response inalterada; efeito colateral novo
  (revogacao de portal) e interno.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma nova; usa `AnexoAtendimento`,
  `AtendimentoClinico`, `Exame` ja existentes.
- Indices/constraints: nenhum novo.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: nenhuma - o comportamento de bloqueio (409) na exclusao
  de exame pela tela de Laudos passa a existir no backend; a tela de Laudos
  ja trata erros de API genericamente.
- Estados de UI: N/A.
- Regras de exibicao/erro: mensagem de erro do 409 vem do backend
  (`_motivo_bloqueio_exclusao_exame`), consistente com a mensagem que o
  modulo de Atendimento ja mostra para o mesmo bloqueio.

## 5) Compatibilidade e rollout

- Backward compatibility: `PUT /exames/{id}` passa a ignorar alguns campos
  que antes eram aplicados sem checagem (`atendimento_id`, `laudo_id` de
  outro paciente, `status` de liberacao direta) - mudanca de comportamento
  intencional (fecha um bug de seguranca/integridade), nao de contrato de
  campos aceitos.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  permissivo anterior (nao ha migracao de dados a desfazer).

## 6) Criterios de aceitacao (CA)

- CA-001: `PUT /exames/{id}` com `atendimento_id` no payload nao altera o
  vinculo do exame.
- CA-002: `PUT /exames/{id}` tentando setar status de liberacao direta e
  ignorado (exame permanece no status anterior).
- CA-003: `PUT /exames/{id}` com outras transicoes de status validas
  aplica a mudanca e audita.
- CA-004: `DELETE /exames/{id}` com anexo e bloqueado (409).
- CA-005: `DELETE /exames/{id}` com laudo vinculado e bloqueado (409).
- CA-006: `DELETE /exames/{id}` liberado no portal e bloqueado (409).
- CA-007: `DELETE /exames/{id}` sem bloqueios exclui e audita.
- CA-008: `DELETE /laudos/{id}` de um laudo cujo exame esta liberado no
  portal revoga a liberacao (status muda, `laudo_id` fica nulo) e preserva
  o anexo publicado (o arquivo nao e apagado - so deixa de ser servido
  porque o exame nao aparece mais como liberado).

## 7) Casos de borda

- CB-001: `laudo_id` de outro paciente no `PUT /exames/{id}` e ignorado
  silenciosamente (nao retorna erro), mesma semantica de `_sync_exames`.
- CB-002: excluir um Laudo sem nenhum Exame vinculado com liberacao de
  portal continua funcionando exatamente como antes (nenhum efeito extra).

## 8) Fora de escopo

- Unificacao das rotas de edicao/exclusao de exame entre Atendimento e
  Laudos em um unico endpoint.
- Guard equivalente para outras entidades compartilhadas entre os dois
  modulos (ex.: `AnexoAtendimento` editado fora do fluxo de Atendimento).
