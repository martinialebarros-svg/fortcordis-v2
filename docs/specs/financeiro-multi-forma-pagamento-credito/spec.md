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
- RF-011 (2026-10-31): Desfazer recebimento no Financeiro deve abrir um modal da aplicacao com numero da OS, paciente, clinica e valor, com acoes explicitas de cancelar e confirmar. Este fluxo nao deve depender de `window.confirm` ou `window.alert`, inclusive para sucesso/erro.
- RF-012 (2026-10-31): ao alterar o desconto na Agenda Lista ou FullCalendar, o pagamento unico sugerido acompanha o novo liquido se ainda corresponder ao valor anterior a cobrir. Valores diferentes da sugestao e pagamentos divididos sao preservados. Desconto integral pode receber a OS sem entrada ficticia.
- RF-013: escopo confirmado pelo usuario em 2026-10-31: baixa de saldo ja existente de cliente/clinica, sem contrapartida. Excedentes do recebimento mantem o contrato existente de geracao de credito; a correcao do desconto evita um excedente artificial na sugestao de pagamento.
- RF-014: os tres modais individuais oferecem baixa parcial ou integral do credito existente de cliente ou clinica, independente do recebimento. Exige admin, valor positivo em centavos, saldo suficiente e motivo. Nao movimenta caixa, nao cria pagamento e nao quita OS.
- RF-015: baixa gera movimento negativo `baixa_sem_contrapartida`, preservando os movimentos originais, autor e data. Uma chave UUID permite repetir a mesma solicitacao sem duplicar a baixa. A UI oferece desfazer a ultima baixa, cancelando apenas o movimento administrativo.
- RF-016: consultas de saldo do cliente por paciente incluem o saldo compartilhado pelo tutor, com a mesma regra aplicada no consumo. Baixa atualiza o saldo do modal e desmarca consumo previamente selecionado.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (consistencia): desfazer recebimento deve cancelar todas as transacoes do recebimento multiplo e invalidar creditos gerados daquele evento.
- NFR-002 (governanca): criacao/edicao de cadastro de bandeiras/formas deve ser restrita a perfil `admin`.
- NFR-003 (observabilidade operacional): payloads de retorno devem expor totais (bruto/taxa/liquido/excedente) para rastreabilidade.
- NFR-004 (acessibilidade operacional): no modal de recebimento individual do Financeiro, o formulario deve rolar dentro da viewport e manter as acoes de cancelar e confirmar acessiveis, mesmo com varias formas de pagamento.
- NFR-005 (2026-10-31): o modal de reversao deve ter nome e descricao acessiveis, foco inicial em Cancelar, navegacao por Tab contida e Escape para cancelar antes do envio. Durante a requisicao, cancelar/confirmar/Escape ficam bloqueados, com protecao contra envio duplicado.
- NFR-006: baixar e desfazer baixa adquirem bloqueio do titular em Postgres, ou `BEGIN IMMEDIATE` em SQLite; consumo em OS e desfazer recebimento usam o mesmo bloqueio. Nao e permitido desfazer uma OS se remover seu credito produzir saldo negativo; deve-se desfazer primeiro a baixa ou uso dependente.
- NFR-007: baixa independente nao tem `ordem_servico_id` nem `transacao_id`, portanto nao e desfeita incidentalmente pela reversao de um recebimento. Desfazer baixa preserva o historico (`Cancelado`).

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
- `GET /financeiro/creditos/disponivel?tipo_destino=cliente|clinica&paciente_id=...&clinica_id=...`: saldo do titular e `pode_baixar`.
- `POST /financeiro/creditos/baixar`: `tipo_destino`, `paciente_id` ou `clinica_id`, `valor`, `motivo`, `idempotency_key` UUID; retorna movimento e saldo restante. Restrito a admin.
- `POST /financeiro/creditos/{id}/desfazer-baixa`: restaura saldo sem remover o historico; repeticao nao duplica restauracao. Restrito a admin.
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
- CA-010: com duas ou mais formas de pagamento no recebimento individual do Financeiro, a area do formulario pode ser rolada e o botao `Confirmar Recebimento` permanece visivel e acionavel.
- CA-011 (2026-10-31): abrir ou cancelar o modal de Desfazer nao envia requisicao; confirmar envia um unico `PATCH /ordens-servico/{os_id}/desfazer-recebimento` para a OS exibida. Sucesso fecha o modal, anuncia o numero da OS na pagina e recarrega a lista. Falha preserva o modal com erro visivel, sem anunciar sucesso nem repetir automaticamente a operacao.
- CA-012: OS de R$ 340 com desconto R$ 90 sugere R$ 250 e pode ser recebida sem credito. Um pagamento real de R$ 340 continua gerando R$ 90 de credito conforme o destino informado.
- CA-013: credito R$ 100 pode ser baixado em R$ 40 sem devolucao, transacao ou mudanca de status da OS, restando R$ 60; desfazer restaura R$ 100 e preserva o registro.
- CA-014: duplicacao da mesma chave nao baixa duas vezes; motivo vazio, valor invalido/acima do saldo e perfil sem admin sao rejeitados sem gravacao parcial.

## 7) Casos de borda

- CB-001: total dos pagamentos menor que valor da OS deve bloquear recebimento.
- CB-002: taxa calculada maior que valor bruto da linha deve bloquear recebimento.
- CB-003: excedente com destino `nenhum` deve bloquear e exigir definicao explicita.
- CB-004: OS sem clinica nao pode gerar credito com destino `clinica`.

## 8) Fora de escopo

- Consumo automatico de credito em uma OS futura.
- Parcelamento com agenda de liquidacao por adquirente (D+N por parcela).
- A troca do modal de Desfazer nao altera os contratos de API, regras de cancelamento, dados financeiros ou preenchimento da data de Receber, nem executa correcao de OS real. Publicacao continua sendo uma etapa separada. Rollback da UI: reverter o componente/handler; nao ha migracao nem transformacao de dados nesta alteracao.
