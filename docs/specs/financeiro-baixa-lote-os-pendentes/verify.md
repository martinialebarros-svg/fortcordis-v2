# Verify - financeiro-baixa-lote-os-pendentes

Data: 2026-10-10
Responsavel: Martiniano + Codex
Status: homologacao e producao publicadas; 100 testes direcionados revalidados no SHA de producao

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

O [PR #333](https://github.com/martinialebarros-svg/fortcordis-v2/pull/333)
foi integrado em `f5ed6699571aa43bf14de58a5e304370d22d2514`. O
[Deploy to Stage #38078780987](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38078780987)
terminou com sucesso em 2026-10-10 as 19:22 UTC:

- SDD e quality-gate aprovados: **1609 testes backend, OK (8 skips)**,
  **10 disputas PostgreSQL** e **43 testes da tela Financeiro**.
- Frontend CI e Migration CI do mesmo SHA concluidos com sucesso.
- Health, readiness, canario autenticado e exercicio de restauracao aprovados;
  banco SQLite e arquivos runtime de frases preservados/restaurados.
- **21 testes de lote executados no Python instalado no stage**, depois da
  conferencia do SHA, com bancos temporarios e notificacoes simuladas: `OK`.

Na revalidacao de 10/10, o HTML de Financeiro respondeu 200. Dos 14 chunks
referenciados, quatro responderam 200 e dez tiveram timeout TCP. O chunk
`app/financeiro/page-11d582143c7ec32d.js` respondeu 200 e contem os marcadores
`/ordens-servico/receber-lote`, conflito sem baixa do lote e resultado incerto.
SHA-256: `abe3ff88243a3b89b487e53044654cac5aba3a3e255788177c651e31e9a8ff8b`.
Isso comprova o codigo servido de Financeiro, mas nao um smoke externo completo.

## 4) Limites e roteiro manual

Na sessao autenticada de stage, foram conferidos abertura de grupo, leitura das
OS, abertura do modal com tres OS e total preenchido, bloqueio da confirmacao
com valor divergente e habilitacao com valor exato. O formulario foi cancelado
e o grupo fechado, sem confirmar baixa ou enviar recibo. As ativacoes por
clique da automacao nao produziram efeito; ativacao por teclado funcionou.
Nao se atribuiu esse comportamento a uma falha do guard da aplicacao.

A disputa financeira foi validada com dados sinteticos pelos testes, inclusive
PostgreSQL real. O roteiro completo abaixo ainda nao foi executado por duas
sessoes autenticadas no navegador; os testes nao equivalem a essa prova manual.

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

- Homologacao publicada e producao autorizada pelo pedido "teste e publique".
- O [PR #335](https://github.com/martinialebarros-svg/fortcordis-v2/pull/335)
  ja havia promovido a correcao pelo fluxo direto `stage -> main`, junto com a
  entrega de Agenda. Producao em `adcc15dcde2cf714760c2bcbc6ee81e491f663dc`;
  arvore identica ao stage `56d95e987590303b79d44184c580a5544d7c0517`.
- [Deploy to VPS #38098205399](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38098205399)
  concluido com sucesso em 10/10/2026 as 21:34 (Fortaleza). Frontend CI e
  Migration CI do mesmo SHA tambem aprovados. Logs confirmam preservacao e
  restauracao de seis arquivos runtime, readiness, canario 5/5 e restore drill.
- A [evidencia registrada na publicacao](https://github.com/martinialebarros-svg/fortcordis-v2/pull/335#issuecomment-6103831257)
  inclui conferencia SSH do SHA, 20/20 verificacoes HTTPS nos cinco dominios,
  15 chunks 200 a partir da VPS e carregamento autenticado do Financeiro.
  Esses checks pertencem a publicacao anterior e nao foram repetidos nesta
  revalidacao. Nesta rodada local, a API de OS sem credenciais retornou 401;
  `/financeiro` e `/api/health` de producao tiveram timeout TCP.
- Revalidacao no SHA de producao: **57/57 testes backend** (21 lote, 17 ajuste,
  9 exclusao de Atendimento e 10 PostgreSQL concorrente) e **43/43 testes de
  Financeiro** passaram. Cluster descartavel encerrado, sem schemas de teste.
- Nenhuma transacao financeira persistente ou envio real de WhatsApp foi feito.
  Sem migracao de banco. Nao foi necessario novo deploy do mesmo codigo.
