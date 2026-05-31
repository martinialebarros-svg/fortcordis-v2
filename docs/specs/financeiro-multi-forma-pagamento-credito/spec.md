# Spec - financeiro-multi-forma-pagamento-credito

Data: 2026-05-25  
Responsavel: Martiniano + Codex  
Status: done

## 1) Escopo funcional

Evoluir o recebimento financeiro de Ordem de Servico (OS) para suportar pagamento fracionado em multiplas formas, com cadastro de bandeiras e meios de pagamento com taxas, geracao de credito por excedente (cliente/clinica), e exposicao desses valores em relatorios financeiros operacionais.

## 2) Requisitos funcionais (RF)

- RF-001: OS deve aceitar mais de uma forma de pagamento no mesmo recebimento.
- RF-002: cada forma de pagamento deve permitir taxa percentual e taxa fixa para calcular valor liquido.
- RF-003: deve existir cadastro de bandeiras de cartao.
- RF-004: deve existir cadastro de formas de pagamento (incluindo adquirente/maquininha e bandeira opcional).
- RF-005: se pagamento bruto superar o valor da OS, o excedente deve poder virar credito para cliente ou clinica.
- RF-006: modais de recebimento de OS em Agenda Lista, FullCalendar e Financeiro devem permitir:
  - multiplas linhas de pagamento;
  - data de recebimento;
  - destino do credito quando houver excedente.
- RF-007: relatorios financeiros devem expor taxas de pagamento e creditos gerados.
- RF-008: fluxo legado com `forma_pagamento` unica deve permanecer compativel para rollback controlado.
- RF-009: no recebimento da OS (Agenda Lista e FullCalendar), deve existir campo de desconto explicito no modal, com recalculo do valor liquido da OS antes da validacao de cobertura.
- RF-010: no modulo Financeiro, a tabela de formas de pagamento deve permitir editar as taxas aplicadas (percentual e fixa) sem desativar/recriar o cadastro.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (consistencia): desfazer recebimento deve cancelar todas as transacoes do recebimento multiplo e invalidar creditos gerados daquele evento.
- NFR-002 (governanca): criacao/edicao de cadastro de bandeiras/formas deve ser restrita a perfil `admin`.
- NFR-003 (observabilidade operacional): payloads de retorno devem expor totais (bruto/taxa/liquido/excedente) para rastreabilidade.

## 4) Contratos tecnicos

### API

- `PATCH /ordens-servico/{os_id}/receber`
  - novo suporte a `pagamentos[]` com `forma_pagamento`, `forma_pagamento_config_id`, `valor`, `data_recebimento`, `taxa_percentual`, `taxa_fixa`.
  - novo suporte a `desconto` no ato do recebimento, com persistencia em `ordens_servico.desconto` e recalc de `valor_final`.
  - novo suporte a `destino_credito_excedente`.
- `PATCH /ordens-servico/{os_id}/desfazer-recebimento`
  - deve cancelar lote de transacoes e creditos vinculados.
- `GET/POST/PUT /financeiro/bandeiras-cartao`
- `GET/POST/PUT/DELETE /financeiro/formas-pagamento`
- `GET /financeiro/creditos/movimentos`
- `GET /financeiro/creditos/saldos`
- `GET /financeiro/relatorios/taxas-forma-pagamento`

### Banco/migracoes

- Migracao nova: `20260525_41_financeiro_multiplos_pagamentos_credito.py`
- Colunas novas em `transacoes`:
  - `forma_pagamento_config_id`
  - `adquirente_pagamento`
  - `bandeira_pagamento`
  - `taxa_percentual`
  - `taxa_fixa`
  - `valor_taxa`
- Tabelas novas:
  - `bandeiras_cartao`
  - `formas_pagamento_config`
  - `ordens_servico_pagamentos`
  - `creditos_financeiros`

### Frontend

- Telas afetadas:
  - `frontend/app/agenda/page.tsx`
  - `frontend/app/agenda/fullcalendar/page.tsx`
  - `frontend/app/financeiro/page.tsx`
  - `frontend/app/relatorios/components/views/*`
- Comportamento:
  - modais com linhas multiplas de pagamento;
  - campo de desconto no recebimento da OS (agenda lista e fullcalendar);
  - exibicao de taxa estimada por linha;
  - resumo bruto/desconto/liquido/taxa/faltante/excedente;
  - escolha de destino de credito.
  - no cadastro de meios de pagamento, acao de edicao de taxas (percentual/fixa) por linha.

## 5) Compatibilidade e rollout

- Backward compatibility: mantida via fallback no endpoint de recebimento usando payload legado.
- Migracao: idempotente para Postgres/SQLite.
- Rollback: reverter feature para fluxo unico reaproveitando `forma_pagamento` e ignorando tabelas novas.

## 6) Criterios de aceitacao (CA)

- CA-001: secretária consegue registrar uma OS com 2+ formas de pagamento no mesmo modal.
- CA-002: taxa da forma de pagamento reduz valor liquido recebido e fica registrada em transacao.
- CA-003: excedente acima do valor da OS gera credito conforme destino selecionado.
- CA-004: desfazer recebimento retorna OS para pendente e cancela transacoes/credito do lote.
- CA-005: fullcalendar e agenda lista apresentam o mesmo fluxo de recebimento multiplo.
- CA-006: resumo financeiro e relatorio de controle exibem taxas de pagamento e creditos gerados.
- CA-007: cadastro de bandeira/forma via API rejeita usuario sem papel admin.
- CA-008: secretaria pode informar desconto no modal de recebimento da agenda e o backend deve validar `desconto <= valor_servico`, recalculando o valor da OS para cobertura.
- CA-009: admin consegue editar `taxa_percentual` e `taxa_fixa` de forma de pagamento existente e a alteracao reflete nos proximos recebimentos.

## 7) Casos de borda

- CB-001: total dos pagamentos menor que valor da OS deve bloquear recebimento.
- CB-002: taxa calculada maior que valor bruto da linha deve bloquear recebimento.
- CB-003: excedente com destino `nenhum` deve bloquear e exigir definicao explicita.
- CB-004: OS sem clinica nao pode gerar credito com destino `clinica`.

## 8) Fora de escopo

- Consumo automatico de credito em uma OS futura.
- Parcelamento com agenda de liquidacao por adquirente (D+N por parcela).
