# Plan - financeiro-multi-forma-pagamento-credito

Data: 2026-05-25  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): criar estrutura para multipagamento, cadastro de meios e creditos financeiros.
- Fase 2 (backend/API): evoluir recebimento OS para `pagamentos[]`, taxas, credito por excedente e consumo de credito.
- Fase 3 (frontend): unificar modais de recebimento (Agenda, FullCalendar, Financeiro) com multipagamento e uso de credito.
- Fase 4 (integracao/observabilidade): validar guardrail SDD, smoke operacional e relatorios.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar migracao `20260525_41_financeiro_multiplos_pagamentos_credito.py`.
- [x] T1.2 Adicionar tabelas/colunas para formas, bandeiras, pagamentos por OS e creditos.
- Criterio de conclusao: migracao aplica sem erro em stage/local.
- Risco: medio.
- Rollback: reverter commit da migracao e restaurar backup do banco.

### Fase 2

- [x] T2.1 Implementar endpoints de cadastro/admin para bandeiras e formas de pagamento.
- [x] T2.2 Implementar recebimento OS multipagamento com taxa e geracao de credito por excedente.
- [x] T2.3 Implementar consumo de credito no recebimento e cancelamento no desfazer recebimento.
- Criterio de conclusao: endpoint `/ordens-servico/{id}/receber` aceita cobertura por pagamentos e/ou credito e retorna totais.
- Risco: alto (integridade financeira).
- Rollback: fallback para fluxo legado `forma_pagamento` unica e desativacao temporaria do uso de credito.

### Fase 3

- [x] T3.1 Ajustar modais de recebimento para multiplas formas e resumo de taxa.
- [x] T3.2 Exibir aviso explicito de credito ativo do cliente.
- [x] T3.3 Habilitar opcao de usar credito no recebimento com valor controlado.
- Criterio de conclusao: os 3 modais apresentam comportamento equivalente e enviam `valor_credito_utilizado`.
- Risco: medio.
- Rollback: remover campos novos dos modais e manter recebimento tradicional.

### Fase 4

- [x] T4.1 Validar lint/tsc/frontend e testes backend focal.
- [x] T4.2 Atualizar SDD completo (`intent.md`, `spec.md`, `plan.md`, `verify.md`) no mesmo ciclo.
- Criterio de conclusao: pipeline stage aprovado com guardrail SDD.
- Risco: medio.
- Rollback: ajustar artefatos SDD e republicar deploy.

## 3) Plano de testes

- Testes unitarios: foco em regras de recebimento/desfazer e agregacoes financeiras.
- Testes de integracao: endpoint `/ordens-servico/{id}/receber` com cenarios de parcial, total e excedente.
- Testes manuais: smoke de recebimento em Agenda, FullCalendar e Financeiro com uso de credito.

## 4) Dependencias e bloqueios

- Dependencia 1: ambiente `backend/venv` com dependencias atualizadas para pytest.
- Dependencia 2: guardrail SDD exigindo estrutura completa da feature no diretorio de specs.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
