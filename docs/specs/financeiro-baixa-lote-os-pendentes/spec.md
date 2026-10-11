# Spec - financeiro-baixa-lote-os-pendentes

Data: 2026-10-10
Atualizacao: 2026-10-11
Responsavel: Martiniano + Codex
Status: baixa atomica publicada; correcao da composicao dos recibos com testes direcionados locais aprovados, sem reteste em stage

## 1) Escopo funcional

Adicionar baixa em lote para ordens de servico pendentes no modulo Financeiro.
Os recibos devem representar os recebimentos ativos, inclusive depois do ciclo
receber, desfazer e receber novamente, sem apagar o historico financeiro.

## 2) Requisitos funcionais

- RF-001: usuario deve conseguir selecionar OS pendentes para baixa em lote.
- RF-002: usuario deve conseguir selecionar todas as OS pendentes visiveis na aba Ordens de Servico.
- RF-003: usuario deve conseguir receber todas as OS pendentes de uma clinica no card de Cobrancas por Clinica.
- RF-004: modal de baixa em lote deve exibir quantidade, lista resumida e total das OS selecionadas.
- RF-005: modal deve permitir informar data de recebimento e uma ou mais formas de pagamento.
- RF-006: total informado deve bater exatamente com o total das OS selecionadas.
- RF-007: sistema deve ratear os pagamentos informados entre as OS selecionadas preservando o valor final de cada OS.
- RF-008: apenas OS com status `Pendente` podem entrar na baixa em lote.
- RF-009: apos sucesso, a selecao de baixa deve ser limpa e os dados financeiros recarregados.
- RF-010: o modal de baixa individual oferece o envio opcional do recibo PDF oficial depois do
  recebimento.
- RF-011: a baixa em lote oferece um unico recibo PDF consolidado quando todas as OS pertencem ao
  mesmo destinatario e possuem um WhatsApp cadastrado em comum.
- RF-012: falha no envio posterior do recibo nao desfaz OS ja recebidas e deve ser comunicada
  separadamente do resultado financeiro.
- RF-013: a composicao do recibo deve incluir somente pagamentos vinculados a transacoes
  de `entrada` com status `Recebido` ou `Pago`, alem de consumo de credito ativo.
  Pagamentos cancelados, pendentes ou de saida nao compoem formas, datas, taxas ou liquido.
- RF-014: emitir recibo nao pode apagar nem reescrever pagamentos historicos ou transacoes.
- RF-015: recebimento exclusivamente por credito ativo deve continuar emitindo recibo;
  historico legado sem vinculo nao pode inventar forma, taxa ou valor liquido.
- RF-016: pagamento com ID de transacao preenchido sem transacao correspondente ou
  composicao ativa insuficiente deve impedir a emissao do recibo com `409`.

## 3) Requisitos nao funcionais

- NFR-001: baixa em lote usa uma unica transacao no backend e compartilha as regras do recebimento individual, sem commits intermediarios.
- NFR-002: fluxo deve manter os controles existentes de recibo para OS recebidas sem misturar selecoes.
- NFR-003: UI deve informar claramente total selecionado e diferencas entre total das OS e total informado.
- NFR-004: o PDF enviado deve reutilizar o gerador oficial de recibos, sem gerar documento divergente
  no frontend.
- NFR-005: o envio oficial depende de modelo Meta aprovado com cabecalho de documento.
- NFR-006: a mesma composicao financeira deve alimentar PDF individual, consolidado,
  Portal da Clinica e PDF destinado ao WhatsApp; nenhum canal pode reincluir historico cancelado.

## 4) Contratos tecnicos

### Frontend

- Tela afetada: `frontend/app/financeiro/page.tsx`
- Estados novos:
  - `osSelecionadasBaixa`
  - `modalReceberLoteOS` (snapshot das OS conferidas)
  - `recebendoLoteOS`
  - `enviarReciboPdfWhatsAppAposRecebimento`
- Acoes:
  - `Selecionar pendentes`
  - `Receber selecionadas`
  - `Receber pendentes` por clinica

### Backend

- `PATCH /ordens-servico/receber-lote` recebe `ordens` (1 a 200 itens unicos com
  `os_id` e `valor_final_esperado` decimal), `pagamentos` (1 a 20 itens) e
  `data_recebimento` opcional. Nao aceita desconto ou uso/geracao de credito no lote.
- O backend bloqueia todas as OS por ID crescente e revalida existencia, status
  `Pendente` e valor esperado antes de gravar. Pagamento/cancelamento/ajuste concorrente
  invalida o lote com `409`; nenhuma baixa desse lote e persistida.
- Rateio em centavos preserva o valor de cada OS, cada forma e o total do lote.
  Transacoes, pagamentos, auditorias e cancelamento de lembretes ficam na mesma
  transacao; notificacoes externas ocorrem somente depois do commit.
- Resposta de sucesso: `os_ids` de todas as OS recebidas e `mensagem`.
- O modal preserva a selecao e os valores conferidos na abertura. Atualizacao da lista
  nao pode remover silenciosamente uma OS do lote. Em conflito ou resultado incerto,
  o erro fica visivel no modal e exige nova conferencia/selecao antes de tentar de novo.
- O frontend verifica que a resposta contem exatamente todas as OS esperadas antes
  de solicitar o recibo. Falha da baixa nunca dispara recibo parcial.
- Depois do sucesso integral do lote, o frontend pode chamar `/{id}/whatsapp/recibo-pdf` ou
  `/whatsapp/recibos-pdf` para enviar o documento individual ou consolidado.

### Composicao dos recibos apos desfazer e receber novamente

- `_montar_recibos_os` consulta o historico sem altera-lo. Um pagamento so entra na
  composicao se sua `Transacao` existir, for de `entrada` e estiver `Recebido` ou `Pago`.
  Apenas esses pagamentos fornecem datas de recebimento, formas, taxas e liquido.
- O consumo de credito com status ativo soma-se aos pagamentos ativos. A cobertura
  em centavos (`bruto ativo + credito ativo`) deve ser ao menos o valor final da OS;
  cobertura menor retorna `409`. Cobertura maior permanece aceita para preservar
  recebimentos com excedente legitimo ja suportados pelo fluxo individual.
- Se `transacao_id` estiver preenchido e a transacao nao existir, retorna `409`,
  mesmo que outros pagamentos ativos cubram o valor da OS. Nao e tratado como legado.
- Legado sem composicao detalhada fica restrito a OS paga sem pagamentos ativos,
  sem credito ativo e sem qualquer historico com `transacao_id` preenchido: nenhum
  pagamento ou somente vinculos nulos. Nesse caso, mantem-se a declaracao do valor
  nominal da OS e informa-se a ausencia de composicao, sem inventar pagamentos.
  Taxas e liquido sao `None`, exibidos como `-` e acompanhados de aviso no PDF.
- Historico com transacao cancelada, pendente ou de saida nao autoriza o fallback
  legado. Se nao houver cobertura ativa suficiente, a emissao retorna `409`.
- A validacao ocorre antes da geracao do documento e do envio. Uma OS inconsistente
  impede o recibo consolidado inteiro; nao se produz documento parcial.

## 5) Criterios de aceitacao

- CA-001: usuario consegue selecionar 2+ OS pendentes e abrir o modal de baixa em lote.
- CA-002: modal inicia com total das OS preenchido na forma de pagamento padrao.
- CA-003: ao confirmar com valor igual ao total, todas as OS selecionadas passam para `Pago`.
- CA-004: ao informar valor menor ou maior que o total, confirmacao fica bloqueada e mostra a diferenca.
- CA-005: OS pagas continuam usando selecao de recibo, e OS pendentes usam selecao de baixa.
- CA-006: baixa por card de clinica recebe apenas as OS pendentes daquele grupo.
- CA-007: recebimento individual oferece recibo PDF oficial com OS, data, servico, tutor e pet.
- CA-008: recebimento de varias OS do mesmo destinatario oferece um unico PDF consolidado.
- CA-009: falha no WhatsApp posterior a baixa mantem o recebimento e mostra aviso separado.

- CA-010: OS paga, cancelada, ausente ou com valor alterado impede o lote inteiro;
  o estado concorrente e preservado e as demais OS permanecem pendentes.
- CA-011: falha ao processar a ultima OS desfaz as baixas anteriores do lote,
  inclusive transacoes, pagamentos, creditos, auditorias e lembretes.
- CA-012: duas sessoes concorrentes (lote, recebimento individual, cancelamento ou
  lotes sobrepostos) preservam uma unica baixa por OS e nunca deixam lote parcial.
- CA-013: nenhuma falha ou resposta incompleta dispara recibo; modal preserva
  contexto e apresenta erro visivel, sem reduzir silenciosamente a selecao.
- CA-014: rateio de centavos e multiplas formas fecha valores de cada OS e forma,
  sem credito excedente; pagamento repetido do mesmo lote nao duplica transacoes.
- CA-015: receber R$ 230,00, desfazer e receber em lote duas OS de R$ 230,00 preserva
  os tres movimentos historicos (um cancelado e dois ativos), mas o recibo mostra
  somente os dois pagamentos ativos e total de R$ 460,00, sem forma duplicada.
- CA-016: taxas, liquido e datas de pagamentos cancelados nao entram nos recibos;
  PDFs individual/consolidado, Portal e bytes destinados ao WhatsApp usam a mesma regra.
- CA-017: legado sem vinculo permite declaracao de valor da OS com aviso de composicao
  indisponivel e taxas/liquido `-`; nao inventa detalhes nem reaproveita historico cancelado.
- CA-018: vinculo orfao ou cobertura ativa insuficiente retorna `409` sem PDF/envio;
  cobertura exclusivamente por credito ativo suficiente continua valida.

## 6) Limites operacionais

- Uma interrupcao de rede pode ocorrer depois do commit. A UI nao declara que nada
  foi gravado nesse caso; solicita conferencia antes de novo envio. Nao ha replay
  idempotente da resposta nem outbox de recibos neste ciclo.
- Cancelar ou excluir OS paga exige desfazer o recebimento explicitamente. Essa
  verificacao ocorre com lock, inclusive na exclusao indireta de Atendimento.
- Envio real de WhatsApp depende de destinatario de teste autorizado; testes
  automatizados interceptam o transporte.
- A correcao da composicao se aplica aos novos recibos gerados. PDFs previamente
  baixados ou enviados nao sao corrigidos retroativamente.
