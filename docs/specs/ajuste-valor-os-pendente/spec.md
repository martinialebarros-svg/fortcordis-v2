# Spec — ajuste de valor de OS pendente

Data: 2026-10-06
Responsável: Martiniano + Codex
Status: implementação e validação local concluídas; publicação autorizada

## 1. Escopo

Uma OS criada pela finalização de Atendimento ou por outro fluxo pode ter
seu valor final corrigido enquanto estiver `Pendente`. O ajuste é uma ação
financeira própria, com motivo e conferência da versão observada. Ele não
altera o atendimento ou a origem da OS.

## 2. Requisitos funcionais

- **RF-001:** somente usuário autenticado com permissão de edição de ordens
  de serviço pode solicitar o ajuste.
- **RF-002:** o endpoint aceita apenas OS existente com status `Pendente`.
  `Pago` e `Cancelado` retornam conflito sem alteração; OS inexistente
  retorna `404`.
- **RF-003:** o pedido informa `valor_final_esperado`,
  `novo_valor_final` e `motivo`. O motivo, após retirar espaços externos,
  deve ser não vazio. `valor_final_esperado` pode ser zero;
  `novo_valor_final` deve ser positivo. Ambos devem ser finitos,
  representáveis em centavos e dentro dos limites de `Numeric(10,2)`.
- **RF-004:** o servidor compara `valor_final_esperado` ao valor persistido
  sob controle de concorrência. Divergência retorna `409` com mensagem de
  valor desatualizado, sem sobrescrever a alteração concorrente. A UI não
  repete automaticamente a operação com outro valor esperado.
- **RF-005:** no sucesso, `valor_final = novo_valor_final`, `desconto`
  permanece igual e `valor_servico = novo_valor_final + desconto`. A
  alteração não muda a tabela ou negociação de preço do serviço.
- **RF-006:** número, status, paciente, clínica, serviço, origem, data e tipo
  de horário, `agendamento_id`, `laudo_id`, chave de idempotência e autoria de
  criação permanecem intactos. Atendimento e Agenda vinculados permanecem
  em seus estados anteriores; nenhuma OS nova é criada.
- **RF-007:** registrar uma ação específica de auditoria da OS com usuário,
  motivo, valor final anterior/novo, base anterior/nova e desconto mantido.
  Evento e alteração financeira pertencem à mesma transação: falha em um
  impede o commit do outro. Não inserir conteúdo clínico no evento.
- **RF-008:** a ação está disponível em Cobranças e Ordens para OS
  elegíveis. A interface mostra os valores atual e proposto, exige motivo,
  apresenta progresso/erro e impede envio duplicado.
- **RF-009:** depois do sucesso, Ordens, detalhe do grupo de Cobranças e
  totais pendentes são relidos do servidor. Seleções de baixa com valor
  anterior são invalidadas. Na baixa individual ou em lote, a UI envia
  `valor_final_esperado`; o servidor o compara com o preço persistido sob o
  mesmo lock usado pelo ajuste e rejeita divergência com `409`, antes de criar
  pagamentos ou crédito. O campo é opcional no contrato de API para manter
  clientes existentes compatíveis.
- **RF-010:** uma repetição da finalização do Atendimento reutiliza a mesma
  OS e não recalcula nem desfaz o ajuste. Um recebimento posterior usa o
  `valor_final` atualizado. Se houver push de ajuste, ele só ocorre após o
  commit e inclui o valor persistido atual.

## 3. Contrato técnico

`PATCH /api/v1/ordens-servico/{id}/ajustar-valor`

```json
{
  "valor_final_esperado": 460.00,
  "novo_valor_final": 430.00,
  "motivo": "Correção do valor acordado para o serviço"
}
```

- Sucesso `200`: OS atualizada no formato de detalhe existente, incluindo
  `valor_servico`, `desconto`, `valor_final` e `status` persistidos.
- `401/403`: autenticação ou permissão insuficiente; `404`: OS ausente;
  `409`: OS não pendente ou valor esperado desatualizado; `422`: payload
  inválido. Nenhum desses erros deve persistir mudança parcial.
- Comparar valores com aritmética decimal de centavos. A checagem de status
  e valor esperado e a escrita devem ser protegidas contra duas requisições
  concorrentes para a mesma OS.
- Sem migração prevista: a OS já contém `valor_servico`, `desconto` e
  `valor_final`, e `auditoria_eventos` armazena a ação e seus detalhes. A
  auditoria best-effort atual, que usa sessão separada, não satisfaz RF-007.

## 4. Compatibilidade e efeitos derivados

- A finalização transacional mantém uma OS ativa por agendamento e sua
  idempotência. Este ajuste não é uma operação inversa da finalização.
- Consultas existentes de Ordens/Cobranças, portal da clínica, relatório de
  pendências e exportação fiscal leem `valor_final`; devem refletir o preço
  persistido ao realizar uma nova leitura. Documentos já emitidos não são
  alterados retroativamente.
- A rota de receber aceita `valor_final_esperado` opcional. Quando informado,
  um preço desatualizado retorna `409` sem transação nem crédito; clientes que
  não enviam o campo continuam sujeitos à semântica anterior. Desconto no
  recebimento e desfazer recebimento mantêm seus contratos. A ação de ajuste
  não gera transação, recibo ou crédito.
- A ação `Ajustar valor` altera a base e o valor final diretamente, preserva
  o desconto e exige motivo com auditoria transacional. O fluxo legado
  `Editar` continua permitindo mudar serviço, horário e desconto; essas
  mudanças podem recalcular `valor_final` pela regra anterior e seguem sua
  auditoria existente. Esta feature não converte essas edições em ajustes
  pelo novo endpoint.

## 5. Critérios de aceitação

- **CA-001:** uma OS `Pendente` vinculada a Atendimento concluído aceita
  ajuste autorizado; seu número e vínculos permanecem iguais e Atendimento
  e Agenda conservam os estados. Desconto fica igual; base e valor final
  obedecem a RF-005.
- **CA-002:** exatamente um evento específico de auditoria acompanha o
  ajuste; uma falha ao gravá-lo reverte a mudança financeira.
- **CA-003:** duas tentativas com o mesmo valor esperado não sobrescrevem a
  primeira; a segunda retorna `409` e não cria evento de sucesso nem push.
- **CA-004:** OS paga ou cancelada, valor inválido, motivo vazio e usuário
  sem permissão não modificam OS, Atendimento ou Agenda.
- **CA-005:** Cobranças e Ordens oferecem a ação elegível; após salvar,
  exibem o novo valor e os novos totais. Seleção antiga de baixa não pode
  liquidar o valor anterior. A baixa com `valor_final_esperado` vencido não
  cria crédito excedente. O conflito apresenta a necessidade de reler o valor
  atual e exige revisão antes de tentar novamente.
- **CA-006:** finalizar novamente o Atendimento retorna a mesma OS com o
  valor ajustado; recebimento posterior e eventual push usam o valor atual.
- **CA-007:** portal da clínica e relatório de pendências, após nova
  leitura, exibem o valor atualizado da OS ainda pendente, sem expor motivo
  ou dados clínicos adicionais.

## 6. Casos de borda

- Mudança de status para `Pago` entre abertura do formulário e envio: `409`.
- Ajuste simultâneo em sessões diferentes: apenas uma gravação válida para
  o valor esperado; a outra precisa reler a OS.
- Falha de rede após commit: o operador relê a OS antes de repetir a ação,
  porque o valor esperado anterior já não corresponde ao atual.
- Serviço com desconto prévio: manter o desconto e derivar a base sem alterar
  serviço ou a tabela de preços.

## 7. Fora de escopo

- Reabrir Atendimento, estornar ou cancelar a OS para corrigir o preço.
- Ajustar OS já recebida ou documentos fiscais/recibos emitidos.
- Aplicar a correção à OS real citada no relato.
