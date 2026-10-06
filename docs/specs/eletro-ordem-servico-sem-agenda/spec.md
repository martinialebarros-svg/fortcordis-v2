# Spec — OS no upload de eletro sem Agenda

Data: 2026-10-05
Status: implementado e validado localmente; não publicado

## Comportamento

- RF-001: `/laudos/eletrocardiograma/upload` sem agendamento nem atendimento
  oferece `Gerar ordem de serviço para a clínica`, desmarcado por padrão.
- RF-002: a opção exige paciente, clínica parceira existente, serviço ativo
  selecionado explicitamente e horário comercial ou plantão.
- RF-003: o preço é calculado no servidor pela negociação da clínica ou
  pela tabela aplicável. O formulário mostra a prévia e impede envio com
  prévia indisponível/obsoleta; o servidor exige valor positivo.
- RF-004: a OS nasce `Pendente`, de origem `clinica_parceira`, com desconto
  zero, data do exame, autoria e `laudo_id`; `agendamento_id` fica nulo.
- RF-005: a opção não cria Agenda ou Atendimento, não registra pagamento,
  não libera o laudo no portal e não envia mensagens.
  A pendência financeira entra nas listagens existentes da clínica,
  inclusive no financeiro do portal quando esse acesso já está habilitado.
- RF-006: sem a opção, o comportamento anterior do upload é preservado.
  Pedido de OS com contexto de agendamento/atendimento é rejeitado; esses
  fluxos continuam com sua geração de OS existente.
- RF-007: PDF, laudo, OS e auditoria são gravados atomicamente. Falha reverte
  o banco e remove o novo arquivo; repetir o mesmo pedido com a mesma chave
  retorna os registros existentes, sem nova cobrança. Reutilizar a chave
  com outro conteúdo deve retornar conflito.
- RF-008: criar OS exige permissão de edição de `ordens_servico`, além da
  autorização de Laudos. Dados financeiros na visualização obedecem às
  permissões de OS.
- RF-009: a visualização do laudo mostra número, status e valor da OS
  persistida, com acesso ao Financeiro. Trocar o PDF mantém essa OS.
- RF-010: laudo com OS ativa não pode ser excluído nem ter paciente,
  clínica ou data alterados de forma incompatível; a edição financeira
  também preserva esses vínculos enquanto a OS estiver ativa.
- RF-011: no Financeiro, OS pendente originada de laudo oferece `Cancelar`
  no lugar de exclusão. A cancelada preserva histórico e idempotência e não
  pode ser reativada. Uma OS paga exige desfazer o recebimento antes de
  cancelar. Exclusão física da OS vinculada é rejeitada mesmo após cancelar.

## Contratos

`GET /api/v1/laudos/eletrocardiograma/ordem-servico/preview`

- Query: `clinic_id`, `servico_id`, `tipo_horario` (`comercial`/`plantao`).
- Resposta contém `valor_servico` e `valor_final`.

`POST /api/v1/laudos/eletrocardiograma/upload-pdf`

- Mantém os campos multipart existentes.
- Acrescenta `gerar_ordem_servico` (default falso), `servico_id`,
  `tipo_horario` e `idempotency_key` para o pedido com OS.
- Resposta acrescenta `ordem_servico` com `id`, `numero_os`, `valor_final`
  e `status`, ou `null` quando a opção não foi utilizada.

`GET /api/v1/laudos/{id}` inclui o resumo `ordem_servico` autorizado.

## Aceitação e evidência clínica

1. Enviar PDF com a opção ligada resulta em um laudo finalizado e uma OS
   pendente listada para a clínica no Financeiro, sem agendamento.
2. Upload simples e substituição de PDF seguem funcionando.
3. Clínica ausente/inativa, serviço inválido/inativo, preço inválido,
   permissão insuficiente ou contexto com agenda não geram cobrança.
4. Retry do mesmo pedido não duplica laudo, anexo nem OS.
5. Migração preserva dados, índices e unicidade dos vínculos existentes.
6. UI descarta preços atrasados quando clínica/serviço/horário mudam.

Paciente, clínica e data vêm dos campos confirmados no upload. O conteúdo
do PDF não é extraído nem reinterpretado; a nova opção registra a cobrança
do serviço selecionado, sem acrescentar achados clínicos ao laudo.
