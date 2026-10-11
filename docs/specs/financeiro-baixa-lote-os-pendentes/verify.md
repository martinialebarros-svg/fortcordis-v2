# Verify - financeiro-baixa-lote-os-pendentes

Data: 2026-10-10
Responsavel: Martiniano + Codex
Status: validacao local concluida; homologacao pendente

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | Selecao e modal nas abas Ordens/Cobrancas; testes da tela | ok local |
| CA-002 | Modal inicia com o total do snapshot conferido | ok local |
| CA-003 | Uma PATCH `/ordens-servico/receber-lote`, commit unico | ok local |
| CA-004 | Validacao frontend e backend de total exato | ok local |
| CA-005 | Selecao de recibo separada da selecao de pendentes | preservado |
| CA-006 | Receber pendentes do grupo usa a mesma transacao atomica | ok local |
| CA-007 | Recibo individual posterior ao recebimento | preservado |
| CA-008 | Recibo exige sucesso completo e IDs exatamente iguais | ok local |
| CA-009 | Falha WhatsApp preserva recebimento e informa resultado | ok local, transporte simulado |
| CA-010 | Status pago/cancelado, ausencia e valor divergente geram 409 sem baixa parcial | ok local |
| CA-011 | Falha tardia/commit desfaz OS, movimentos, auditoria e lembretes | ok local |
| CA-012 | 10 disputas reais PostgreSQL com locks observados em pg_stat_activity | ok local |
| CA-013 | Modal conserva snapshot, erro visivel e bloqueio ate nova selecao | ok local |
| CA-014 | Rateio exato por OS/forma/taxa e repeticao sem duplicidade | ok local |

## 2) Evidencia automatizada

- Backend: `tests.test_ordens_servico_receber_lote` cobre endpoint HTTP,
  permissao de edicao, validacao de payload, lock ordenado, unico commit,
  rollback de falha tardia/commit, repeticao, centavos, multiplas formas,
  desconto preservado e taxas rateadas sem repetir taxa fixa.
- `tests.test_ordens_servico_receber_lote_postgres`: 10 cenarios passaram
  em PostgreSQL 16 descartavel local. O teste consulta `pg_stat_activity` para
  provar espera real por lock. Inclui pagamentos/cancelamentos/ajustes/exclusao
  antes e depois do lote, lotes sobrepostos e desfazer posterior.
- `tests.test_atendimento_delete_guard`: 9 testes passaram, incluindo OS stale
  recebida em outra sessao e novo recebimento depois de desfazer.
- Frontend: `app/financeiro/page.test.tsx` cobre sucesso integral, conflito,
  falha de rede/500/422, IDs divergentes, limite de pagamentos, preservacao do
  snapshot e ausencia de recibo parcial. O transporte WhatsApp e simulado.
- Lint completo, TypeScript e build Next.js passaram localmente.
- Suite backend completa: **1588 testes, OK (7 skips)**.
- Suite especifica do lote: **21 testes passaram**; ajuste de valor: **17 passaram**.
- Tela Financeiro: **43 testes passaram** (uma primeira rodada teve um timeout
  transitorio em paginacao preexistente; repeticao integral passou sem alterar teste).
- `git diff --check` e YAML do workflow validos. Gate SDD verificado antes do push.

## 3) Homologacao

O workflow `Deploy to Stage (VPS)` passa a exigir a disputa PostgreSQL e os
testes da tela Financeiro no quality gate. Depois do deploy, executa os testes
de lote com o Python instalado no stage e bancos temporarios SQLite; valida o
SHA publicado antes da execucao. Nenhum dado financeiro persistente ou
destinatario real e usado por esses testes.

Publicacao, resultado terminal e smoke do bundle: pendentes.

## 4) Limites e roteiro manual

A sessao de stage disponivel no navegador esta na tela de login; nao ha prova
manual autenticada ainda. Os testes do processo instalado no stage, quando
concluidos, nao substituem uma interacao de ponta a ponta pelo navegador.

1. Com duas sessoes e OS sinteticas, abrir lote na primeira; pagar ou cancelar
   uma OS na segunda; confirmar lote. Esperado: 409, nenhuma baixa adicional,
   erro no modal, selecao preservada, nenhum recibo.
2. Refazer selecao explicita, informar valor exato e confirmar; todas as OS
   recebem baixa, transacoes e auditorias, com totais e taxas conferidos.
3. Repetir requisicao antiga: 409, sem novo movimento.
4. Simular perda da resposta: UI orienta conferir o resultado sem afirmar que
   nada foi gravado e sem reenviar automaticamente.

Nao ha replay idempotente da resposta nem outbox de recibos. Uma rede
interrompida apos commit exige conferir o estado; repetir o lote pago e
bloqueado. WhatsApp posterior permanece separado e real envio nao faz parte
desta validacao. O consolidado aceita ate 20 OS; a baixa aceita ate 200.

## 5) Decisao de entrega

- Implementacao e testes locais autorizados pelo pedido de correcao.
- Homologacao solicitada; publicacao condicionada aos gates desta revisao.
- Producao fora do escopo desta entrega. Sem migracao de banco.
