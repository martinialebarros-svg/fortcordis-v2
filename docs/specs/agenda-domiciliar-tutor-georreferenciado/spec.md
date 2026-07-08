# Spec - agenda-domiciliar-tutor-georreferenciado

Data: 2026-07-08  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Adicionar um fluxo operacional de atendimento domiciliar na agenda sem depender de uma clinica ficticia. A entrega inclui georreferenciamento de tutor via Google, panorama de pets por tutor, persistencia de `origem_atendimento`, roteamento do mapa usando o endereco do tutor quando o atendimento for domiciliar, e adequacao de OS/financeiro para tratar o tutor como destinatario operacional nesses casos.

## 2) Requisitos funcionais (RF)

- RF-001: a API de tutores deve expor endereco estruturado, status de georreferenciamento e um panorama com os pets vinculados ao tutor.
- RF-002: a API deve permitir geocodificar o endereco do tutor e retornar `latitude`, `longitude`, `place_id` e `endereco_normalizado`.
- RF-003: o modal de novo agendamento deve permitir alternar entre `clinica_parceira` e `domiciliar`.
- RF-004: agendamentos domiciliares devem exigir tutor com endereco georreferenciado antes de salvar.
- RF-005: ao salvar um agendamento domiciliar, o backend deve persistir `origem_atendimento="domiciliar"`, manter `tutor_id` e nao exigir `clinica_id`.
- RF-006: agenda em lista, detalhe e FullCalendar deve rotular atendimentos domiciliares como `Atendimento domiciliar` e usar o endereco do tutor para abrir Waze/Google Maps.
- RF-007: agendamentos legados sem `agendamentos.tutor_id` devem continuar retornando o tutor correto a partir de `pacientes.tutor_id`, inclusive apos migration de backfill.
- RF-008: quando um agendamento domiciliar for concluido, a OS gerada ou editada deve usar o preco domiciliar do servico conforme o tipo de horario.
- RF-009: listagens, filtros e relatorios de OS devem aceitar `origem_atendimento="domiciliar"` e tratar o tutor como destinatario do recebimento quando nao houver clinica.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): fluxos antigos de agenda continuam operando com `origem_atendimento="clinica_parceira"` como default.
- NFR-002 (integridade de dados): migrations do pacote devem ser idempotentes e seguras para bases legadas.
- NFR-003 (usabilidade): o fluxo domiciliar nao deve depender do cadastro improvisado de uma clinica `DOMICILIAR`.
- NFR-004 (governanca operacional): sugestoes automaticas por clinica permanecem condicionadas a clinica georreferenciada; o domiciliar segue fluxo manual nesta fase.

## 4) Contratos tecnicos

### API

- `GET /api/v1/tutores`
  - passa a retornar endereco estruturado, coordenadas, `endereco_normalizado` e `georreferenciado`.
- `GET /api/v1/tutores/{tutor_id}/panorama`
  - retorna `tutor`, `pets` e `resumo` com total de pets, endereco preenchido e status de georreferenciamento.
- `POST /api/v1/tutores/geocode-endereco`
  - recebe endereco do tutor e retorna payload geocodificado do Google.
- `POST /api/v1/agenda` e `PUT /api/v1/agenda/{agendamento_id}`
  - aceitam `origem_atendimento` (`clinica_parceira` ou `domiciliar`) e `tutor_id`.
- `GET /api/v1/agenda`, `GET /api/v1/agenda/{agendamento_id}` e payload realtime
  - retornam `origem_atendimento` e resolvem `tutor_id` legado a partir de `paciente.tutor_id` quando necessario.
- `GET /api/v1/ordens-servico`, `PUT /api/v1/ordens-servico/{os_id}` e `GET /api/v1/ordens-servico/relatorios/pendencias/pdf`
  - aceitam e retornam `origem_atendimento`, com comportamento especifico para OS domiciliar.

### Banco/migracoes

- Tabelas/colunas afetadas:
  - `tutores.latitude`
  - `tutores.longitude`
  - `tutores.place_id`
  - `tutores.endereco_normalizado`
  - `agendamentos.tutor_id`
  - `agendamentos.origem_atendimento`
  - `ordens_servico.origem_atendimento`
  - `ordens_servico.clinica_id` passa a aceitar `NULL` para OS domiciliar
- Migrations:
  - `20260707_45_tutores_georreferencia.py`
  - `20260707_46_agendamentos_origem_domiciliar.py`
  - `20260707_47_ordens_servico_domiciliar_financeiro.py`
- Backfill:
  - preencher `agendamentos.tutor_id` a partir de `pacientes.tutor_id` quando o registro legado estiver sem o vinculo persistido.

### Frontend

- Telas afetadas:
  - `frontend/app/agenda/NovoAgendamentoModal.tsx`
  - `frontend/app/agenda/page.tsx`
  - `frontend/app/agenda/fullcalendar/page.tsx`
  - `frontend/app/financeiro/page.tsx`
- Helpers afetados:
  - `frontend/lib/waze.ts`
  - `frontend/lib/agenda-shared-actions.ts`
- Regras de UI:
  - atendimento domiciliar usa tutor como referencia operacional;
  - sem tutor georreferenciado, o save deve ser bloqueado;
  - sugestoes automaticas por clinica nao entram no fluxo domiciliar nesta versao.

## 5) Compatibilidade e rollout

- Backward compatibility: registros antigos continuam aparecendo na agenda mesmo sem `agendamentos.tutor_id` persistido.
- Feature flag: nao.
- Estrategia de rollout:
  - aplicar migrations;
  - validar smoke com tutor georreferenciado;
  - validar agenda/OS domiciliar em producao.
- Rollback:
  - reverter o frontend para ocultar a opcao domiciliar;
  - reverter codigo de agenda/OS;
  - as colunas novas podem permanecer no schema sem uso ativo.

## 6) Criterios de aceitacao (CA)

- CA-001: o tutor exibe panorama de pets e status de georreferenciamento, e a API de geocode retorna payload reutilizavel pelo cadastro.
- CA-002: o sistema bloqueia agendamento domiciliar sem tutor georreferenciado e salva corretamente quando o tutor possui endereco valido.
- CA-003: agenda lista/detalhe/realtime e migration preservam ou recuperam `tutor_id` em agendamentos legados.
- CA-004: OS domiciliar pode existir sem clinica, usa preco domiciliar e aparece em listagens/relatorios com o tutor como destinatario.
- CA-005: agenda em lista e FullCalendar gera links de rota usando o endereco do tutor para itens domiciliares.

## 7) Casos de borda

- CB-001: tutor com endereco textual mas sem coordenadas nao pode ser usado no save domiciliar.
- CB-002: agendamento legado com `paciente_id` valido e `tutor_id` nulo deve continuar retornando tutor corretamente.
- CB-003: OS domiciliar sem clinica nao deve quebrar filtros, resumo financeiro nem relatorio de pendencias.
- CB-004: clinica sem georreferenciamento continua bloqueada nas sugestoes automaticas de agenda.

## 8) Fora de escopo

- Sugestao automatica de horarios baseada em tutor/endereco domiciliar.
- Roteirizacao multi-parada domiciliar.
- Eliminacao de duplicidade historica de tutores.
- Convites e ativacao do portal da clinica parceira.
