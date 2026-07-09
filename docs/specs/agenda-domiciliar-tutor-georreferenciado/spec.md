# Spec - agenda-domiciliar-tutor-georreferenciado

Data: 2026-07-08  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Adicionar um fluxo operacional de atendimento domiciliar na agenda sem depender de uma clinica ficticia. A entrega inclui georreferenciamento de tutor via Google, panorama de pets por tutor, persistencia de `origem_atendimento`, roteamento do mapa usando o endereco do tutor quando o atendimento for domiciliar, e adequacao de OS/financeiro para tratar o tutor como destinatario operacional nesses casos.

## 2) Requisitos funcionais (RF)

- RF-001: a API de tutores deve expor endereco estruturado, status de georreferenciamento e um panorama com os pets vinculados ao tutor.
- RF-002: a API deve permitir geocodificar o endereco do tutor e retornar `latitude`, `longitude`, `place_id` e `endereco_normalizado`.
- RF-002.a: ao informar um CEP valido no modal do tutor, o frontend deve consultar ViaCEP automaticamente e preencher `endereco`, `bairro`, `cidade` e `estado` antes do georreferenciamento final.
- RF-003: o modal de novo agendamento deve permitir alternar entre `clinica_parceira` e `domiciliar`.
- RF-004: agendamentos domiciliares devem exigir tutor com endereco georreferenciado antes de salvar.
- RF-004.a: tutor sem endereco base completo (`endereco`, `numero`, `cidade`, `estado`) ou com coordenadas ausentes/invalidas (ex.: `null`, fora da faixa ou `0,0`) deve ser tratado como nao georreferenciado tanto no frontend quanto no backend.
- RF-005: ao salvar um agendamento domiciliar, o backend deve persistir `origem_atendimento="domiciliar"`, manter `tutor_id` e nao exigir `clinica_id`.
- RF-006: agenda em lista, detalhe e FullCalendar deve rotular atendimentos domiciliares como `Atendimento domiciliar` e usar o endereco do tutor para abrir Waze/Google Maps.
- RF-007: agendamentos legados sem `agendamentos.tutor_id` devem continuar retornando o tutor correto a partir de `pacientes.tutor_id`, inclusive apos migration de backfill.
- RF-008: quando um agendamento domiciliar for concluido, a OS gerada ou editada deve usar o preco domiciliar do servico conforme o tipo de horario.
- RF-009: listagens, filtros e relatorios de OS devem aceitar `origem_atendimento="domiciliar"` e tratar o tutor como destinatario do recebimento quando nao houver clinica.
- RF-010: `POST /api/v1/agenda/sugestoes-horario`, `POST /api/v1/agenda/sugestao-proximidade` e `POST /api/v1/agenda/assistente/ofertas` devem aceitar `origem_atendimento="domiciliar"` e `tutor_id`, tratando o tutor georreferenciado como destino operacional para sugerir horarios, calcular deslocamento e bloquear conflitos.
- RF-010.a: rotas operacionais que envolvam tutor (`clinica` x `domiciliar` ou `domiciliar` x `domiciliar`) devem reaproveitar a mesma matriz persistida de duracao usada no fluxo entre clinicas, com ID sintetico para o tutor e sem obrigar novo lookup Google para o mesmo par enquanto o cache estiver fresco.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): fluxos antigos de agenda continuam operando com `origem_atendimento="clinica_parceira"` como default.
- NFR-002 (integridade de dados): migrations do pacote devem ser idempotentes e seguras para bases legadas.
- NFR-003 (usabilidade): o fluxo domiciliar nao deve depender do cadastro improvisado de uma clinica `DOMICILIAR`.
- NFR-004 (governanca operacional): sugestoes automaticas e validacoes de deslocamento permanecem condicionadas a destino operacional georreferenciado; no domiciliar, o tutor entra nas mesmas regras de folga, trecho vizinho e desvio de insercao.
- NFR-005 (controle de custo Google Maps): fluxo domiciliar deve obedecer ao mesmo gate de lookup ao vivo das clinicas (`LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ`), persistindo heuristica ou resposta Google por par operacional e evitando chamada redundante entre requisicoes para o mesmo destino enquanto a linha estiver fresca.

## 4) Contratos tecnicos

### API

- `GET /api/v1/tutores`
  - passa a retornar endereco estruturado, coordenadas confiaveis, `endereco_normalizado` e `georreferenciado`.
- `GET /api/v1/tutores/{tutor_id}/panorama`
  - retorna `tutor`, `pets` e `resumo` com total de pets, endereco preenchido e status de georreferenciamento.
- `POST /api/v1/tutores/geocode-endereco`
  - recebe endereco do tutor e retorna payload geocodificado do Google.
- `POST /api/v1/agenda` e `PUT /api/v1/agenda/{agendamento_id}`
  - aceitam `origem_atendimento` (`clinica_parceira` ou `domiciliar`) e `tutor_id`.
- `POST /api/v1/agenda/sugestoes-horario`, `POST /api/v1/agenda/sugestao-proximidade` e `POST /api/v1/agenda/assistente/ofertas`
  - aceitam `origem_atendimento` (`clinica_parceira` ou `domiciliar`) e usam `clinica_id` ou `tutor_id` como destino operacional georreferenciado;
  - retornam metadados do destino operacional para o frontend manter o mesmo assistente guiado em fluxos domiciliares.
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
  - `frontend/lib/coordinates.ts`
  - `frontend/lib/waze.ts`
  - `frontend/lib/agenda-shared-actions.ts`
- Regras de UI:
  - atendimento domiciliar usa tutor como referencia operacional;
  - sem tutor georreferenciado, o save deve ser bloqueado;
  - o campo de CEP do tutor deve autopreencher endereco base assim que completar 8 digitos validos;
  - coordenadas ausentes nao podem ser normalizadas para `0,0` durante cadastro/edicao do tutor;
  - o mesmo assistente guiado de agenda deve funcionar para clinica parceira e domiciliar, trocando apenas o destino operacional de referencia.

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
- CA-001.a: o modal do tutor preenche endereco, bairro, cidade e UF ao completar um CEP valido, mantendo o georreferenciamento como etapa posterior dependente do numero.
- CA-002: o sistema bloqueia agendamento domiciliar sem tutor georreferenciado, inclusive quando houver coordenadas invalidas como `0,0`, e salva corretamente quando o tutor possui endereco valido.
- CA-003: agenda lista/detalhe/realtime e migration preservam ou recuperam `tutor_id` em agendamentos legados.
- CA-004: OS domiciliar pode existir sem clinica, usa preco domiciliar e aparece em listagens/relatorios com o tutor como destinatario.
- CA-005: agenda em lista e FullCalendar gera links de rota usando o endereco do tutor para itens domiciliares.
- CA-006: o assistente de agenda sugere horarios e proximidade para atendimentos domiciliares usando o tutor georreferenciado como destino operacional e bloqueia conflitos de deslocamento com as mesmas regras aplicadas a clinicas.
- CA-007: com lookup ao vivo desligado, um par operacional domiciliar novo e materializado por heuristica sem chamar Google; com lookup ao vivo ligado, o mesmo par operacional reutiliza a linha persistida em leituras seguintes sem novo consumo da API.

## 7) Casos de borda

- CB-001: tutor com endereco textual mas sem coordenadas confiaveis nao pode ser usado no save domiciliar.
- CB-005: tutor salvo sem endereco base nao pode virar agendavel por conversao indevida de `null` para `0,0`.
- CB-006: se o usuario alterar o CEP depois de georreferenciar, a geolocalizacao anterior deve ser descartada para evitar rota baseada em endereco antigo.
- CB-002: agendamento legado com `paciente_id` valido e `tutor_id` nulo deve continuar retornando tutor corretamente.
- CB-003: OS domiciliar sem clinica nao deve quebrar filtros, resumo financeiro nem relatorio de pendencias.
- CB-004: clinica sem georreferenciamento continua bloqueada nas sugestoes automaticas de agenda.
- CB-007: atendimento domiciliar sem tutor georreferenciado nao pode ativar sugestao de proximidade nem panorama de horarios, e rotas mistas clinica-domiciliar devem respeitar a mesma margem segura do fluxo convencional.
- CB-008: repetir consultas de sugestao para o mesmo par clinica-tutor nao deve gerar novo lookup Google enquanto a linha operacional persistida continuar fresca.

## 8) Fora de escopo

- Roteirizacao multi-parada domiciliar.
- Eliminacao de duplicidade historica de tutores.
- Convites e ativacao do portal da clinica parceira.
