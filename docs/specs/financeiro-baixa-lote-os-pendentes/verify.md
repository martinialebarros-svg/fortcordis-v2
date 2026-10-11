# Verify - financeiro-baixa-lote-os-pendentes

Data: 2026-10-10
Responsavel: Martiniano + Codex
Status: homologacao e producao publicadas; 100 testes direcionados revalidados no SHA de producao

As secoes 1 a 5 preservam o registro da validacao de 10/10/2026. A secao 6
acrescenta as observacoes de 11/10/2026 e identifica as etapas ainda em execucao.

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

Complemento de 11/10/2026 para o defeito documental descoberto no recibo:

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-015 | Ciclo receber/desfazer/receber reproduziu forma duplicada no PDF, apesar de dois pagamentos ativos e total correto | defeito reproduzido em stage; correcao ok nos testes locais |
| CA-016 | Filtro compartilhado de pagamentos, datas, taxas e liquido em PDF/Portal/WhatsApp | ok local com PDFs reais e transporte WhatsApp simulado |
| CA-017 | Legado sem vinculo identificado, com taxas/liquido nao informados | ok local |
| CA-018 | Bloqueio de vinculo orfao/cobertura insuficiente e preservacao de credito ativo | ok local |

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

## 6) Fechamento de 11/10/2026 — evidencias adicionais e etapas em execucao

### Smoke externo

O [relatorio desta rodada](evidence/smoke-20261011.json), concluido em
11/10/2026 as 12:11:48 (Fortaleza), registra requisicoes HTTPS feitas do
terminal local, sem autenticacao e com validacao normal de TLS. Sao novas
observacoes, distintas dos logs e checks da publicacao de 10/10:

- **24/24 alvos tiveram a resposta esperada observada ao combinar as duas
  rodadas**. A primeira obteve 14/24 e a rodada controlada, 19/24; houve sucesso
  direto em 23/24 URLs. O alvo canonico de stage `/financeiro` respondeu 200
  como destino final dos redirects dos aliases, apesar dos timeouts nas duas
  tentativas diretas.
- **28/28 chunks responderam 200**, sendo 14 de stage e 14 de producao,
  extraidos do HTML retornado. Os chunks de Financeiro dos dois ambientes
  contem o endpoint de lote e as mensagens de conflito e resultado incerto;
  os hashes estao registrados no JSON.
- A API de OS sem credenciais retornou **401 nos oito dominios** verificados.
- As duas rodadas tiveram timeouts ao estabelecer TCP. A intermitencia
  persiste e sua causa nao foi determinada; esses sucessos nao comprovam
  disponibilidade continua. A rodada controlada combinou IPv4, HTTP/1.1,
  DNS fixado e reutilizacao de conexao, sem isolar uma causa.

### Conflito observado no navegador de homologacao

Foram usados o paciente ficticio **204** e o tutor ficticio **198**, sem
contatos, com agendamentos de teste **167** e **168** retroativos a 09/10/2026,
as 10:00 e 11:10, mediante justificativa tecnica explicita. As OS
**2026100001** e **2026100002** tinham valor de **R$ 230,00** cada.

O teste usou **duas abas do navegador integrado com a mesma sessao
autenticada**, mantendo snapshots independentes. Nao foram duas contas ou
duas sessoes autenticadas independentes:

1. A aba A abriu o lote com as duas OS e total de **R$ 460,00**.
2. A aba B recebeu individualmente a OS **2026100002**, mantendo a opcao de
   enviar recibo por WhatsApp desmarcada.
3. A aba A confirmou o lote e exibiu a mensagem: "Uma OS mudou desde a
   conferencia. Nenhuma baixa deste lote foi registrada por esta operacao."
   O modal conservou as duas OS e os **R$ 460,00**, com o botao de confirmar
   desabilitado. A [captura do conflito](evidence/conflito-20261011.png)
   registra esse estado.
4. A atualizacao da lista na aba B mostrou a OS **2026100002 Pago** e a OS
   **2026100001 Pendente**, corroborando que a tentativa do lote nao recebeu
   a OS remanescente.

O status HTTP da requisicao conflitante nao foi capturado. **409** permanece
evidencia do contrato e dos testes automatizados, e nao uma observacao de
rede desta interacao. O teste produziu um recebimento individual persistente
de dados ficticios em homologacao; o registro de ausencia de transacoes na
secao 5 se refere exclusivamente a rodada anterior. Nao houve envio real de
WhatsApp nesta interacao.

### Defeito documental descoberto na continuacao

A primeira reversao foi concluida e a OS **2026100002** voltou a `Pendente`.
Depois de nova selecao, o recebimento em lote de **R$ 460,00** foi concluido
e a lista mostrou **as duas OS Pago**. Esse ciclo preservou tres pagamentos
historicos: um cancelado e dois ativos. As duas OS de R$ 230,00 estavam
representadas no recibo, cujo total permaneceu **R$ 460,00**, mas a OS
**2026100002** exibia duas vezes a forma Dinheiro de R$ 230,00. A
[previa anterior a correcao](evidence/recibo-antes-correcao-20261011.png)
registra as formas duplicadas.

O resultado observado demonstra inconsistencia documental, e nao uma nova
cobranca duplicada: o historico cancelado foi preservado pelo desfazer, mas
continuava compondo o recibo junto aos recebimentos ativos. Uma nova tentativa
de desfazer ficou bloqueada pelo dialogo nativo da automacao, e foi solicitado
cancelar essa tentativa para preservar o caso ate a correcao. Na ultima
atualizacao da aba B, **ambas as OS continuavam Pago**; nao ha prova de que
essa segunda reversao tenha sido aplicada.

A correcao local de `_montar_recibos_os` passa a usar somente transacoes de
entrada `Recebido`/`Pago` e consumo de credito ativo, preservando todas as
linhas historicas. Backend e revisao alinharam as regras seguintes:

- Vinculo preenchido sem transacao correspondente impede o recibo com `409`,
  mesmo quando ha outros pagamentos ativos suficientes.
- Cobertura ativa menor que o valor da OS impede emissao com `409`; excedente
  legitimo permanece aceito. Credito ativo suficiente pode quitar a OS sozinho.
- Ausencia de pagamentos ou somente vinculos nulos, sem credito ativo, admite
  declaracao legada do valor nominal da OS, sem inventar forma. Taxas/liquido
  ficam nao informados e aparecem como `-`, acompanhados de aviso.
- Historico conhecido cancelado, pendente ou de saida nao e convertido em
  legado. Apenas pagamentos ativos fornecem datas, taxas e liquido do recibo.

A validacao direcionada desta correcao passou **71/71 testes**, incluindo
**13 novos testes de recibos ativos** em
`backend/tests/test_ordens_servico_recibos_ativos.py`, 3 do Portal, 21 do lote,
17 do ajuste, 9 da exclusao de Atendimento e 8 do WhatsApp. Foram exercitados
tambem 28 subcasos, sem soma-los como testes independentes.

A cobertura nova verifica o ciclo receber/desfazer/receber com tres movimentos
preservados; PDF individual e consolidado sem forma, taxa ou data cancelada;
geracao real de PDF pelo Portal; bytes de PDF real capturados no adaptador
WhatsApp com transporte simulado; legado, orfao, cobertura insuficiente,
excedente legitimo e credito ativo. Sao testes locais com dados sinteticos;
nao equivalem ao reteste da correcao publicada em stage. Os resultados
historicos das secoes anteriores nao validam esta nova correcao.

Suite backend completa local em 11/10/2026: **1634 testes, OK (7 skips)**,
com banco SQLite sintetico e transportes simulados. O log integral foi
preservado em `/tmp/fortcordis-receipt-full-tests-20261011.log` na estacao de
validacao; nao inclui operacoes em dados reais.

### Etapas ainda em execucao

- Publicar a correcao documental em homologacao para
  conferir um novo recibo do mesmo caso. **O recibo corrigido ainda nao foi
  validado em stage.**
- Concluir e comprovar a reversao final e a limpeza dos registros ficticios.
- PDFs baixados ou enviados antes da correcao nao sao atualizados
  retroativamente. Nao houve envio real de WhatsApp nesta validacao.
