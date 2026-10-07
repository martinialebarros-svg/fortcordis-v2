# Intent — ajuste de valor de OS pendente

Data: 2026-10-06
Responsável: Martiniano + Codex
Status: validação local concluída; publicação autorizada

## Problema

A finalização de um atendimento clínico vinculado à Agenda gera uma ordem de
serviço (OS) automaticamente. Se o preço cobrado precisar de correção depois
da conclusão, o fluxo atual da interface não oferece um ajuste financeiro
simples e rastreável. Cancelar ou reabrir o atendimento para corrigir apenas
o valor colocaria em risco o histórico clínico, o vínculo com a Agenda e a
unicidade da OS ativa.

## Objetivo

Permitir que um usuário autorizado ajuste o valor final de uma OS ainda
`Pendente`, informando o motivo. A OS conserva seu número, vínculos e status;
o novo valor aparece nas telas de Ordens e Cobranças e nos totais derivados.
O ajuste fica registrado em auditoria na mesma transação da alteração.

## Limites

- O ajuste não reabre nem altera Atendimento, Agenda ou laudo, não cria outra
  OS e não modifica a tabela de preços ou a negociação da clínica.
- OS `Pago` e `Cancelado` não são elegíveis. Recebimentos, estornos, recibos
  já emitidos e lançamentos fiscais não são reescritos por esta ação.
- A publicação foi autorizada pelo usuário em 2026-10-06 com a instrução
  "publique". A OS real do caso relatado não é usada como teste de escrita
  nem será ajustada por esta entrega.

## Riscos e sinais de aceite

- Uma edição concorrente ou baixa entre a leitura e o envio não pode perder
  dados: o servidor compara o valor esperado e responde com conflito.
- A composição monetária deve continuar coerente: o desconto existente é
  preservado e a base da OS passa a corresponder ao novo valor final mais o
  desconto.
- Falha de auditoria não pode deixar preço alterado sem registro. A
  notificação financeira, quando emitida, usa o valor já persistido.
- Os totais de Cobranças, a listagem de Ordens e a seleção para baixa devem
  refletir a versão atual após o ajuste.
