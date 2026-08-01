# Intent - atendimento-clinical-lifecycle-foundation

## Problema

O Atendimento permite selecionar `Concluido` como um campo comum e salvar um
registro sem conteudo clinico minimo. Agenda e Atendimento ainda possuem ciclos
independentes, mas a primeira protecao pode ser entregue sem antecipar toda a
integracao transacional.

Tambem existe divergencia de horario quando `datetime-local`, API e SQLite
tratam offsets de maneiras diferentes. Ao iniciar pela Agenda, o backend ja
fornece `agendamento.inicio`, mas a interface nao o utiliza.

## Resultado esperado

- Conclusoes novas clinicamente vazias sao rejeitadas no backend.
- Estados enviados pela API sao normalizados para o vocabulario atual.
- Prontuarios legados concluidos continuam editaveis.
- Indicadores de triagem e consulta refletem a escolha explicita da interface.
- O horario da Agenda chega ao formulario e nao muda em ciclos de salvamento.
- O vinculo com a Agenda fica visivel sem permitir edicao do ID tecnico.

## Fora de escopo

- Sincronizar automaticamente Atendimento, Agenda e ordem de servico.
- Implementar auditoria clinica completa.
- Criar unicidade de atendimento por agendamento.
- Substituir exclusao por cancelamento auditado.
- Corrigir em massa horarios historicos sem origem comprovada.
- Redesenhar toda a tela de Atendimento.

## Restricoes

- Abrir a tela nao pode criar um prontuario.
- A validacao precisa ser backend-enforced.
- A mudanca nao pode impedir correcoes em registros legados ja concluidos.
- A copia local usada no smoke nao pode alterar o banco de desenvolvimento
  original.
