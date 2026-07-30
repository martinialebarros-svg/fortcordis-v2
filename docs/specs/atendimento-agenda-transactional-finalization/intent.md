# Intent - atendimento-agenda-transactional-finalization

## Problema

Atendimento, Agenda e Ordem de Servico possuem finalizacoes independentes. A
Agenda persiste `Realizado` antes de tentar gerar a OS e aceita que uma falha
financeira deixe o agendamento realizado sem a ordem correspondente. O
Atendimento, por sua vez, pode ser marcado como `Concluido` sem atualizar a
Agenda.

O vinculo entre Atendimento e Agenda tambem nao e unico no banco. Duas
requisicoes concorrentes podem criar mais de um prontuario para o mesmo
agendamento ou mais de uma OS ativa.

## Resultado esperado

- Uma acao explicita conclui o Atendimento, realiza a Agenda e cria ou reutiliza
  a OS em uma unica transacao.
- Se qualquer validacao ou geracao da OS falhar, nenhum dos tres estados e
  parcialmente persistido.
- Repetir a finalizacao devolve o mesmo resultado sem duplicar a OS.
- Um agendamento pode possuir no maximo um Atendimento e uma OS nao cancelada.
- A interface direciona a conclusao para a acao explicita e informa com clareza
  o resultado.

## Fora de escopo

- Alterar o fluxo de recebimento ou cancelamento financeiro.
- Migrar, mesclar ou excluir automaticamente duplicidades historicas.
- Substituir toda a auditoria clinica por versionamento campo a campo.
- Remover a finalizacao legada da Agenda para servicos que nao possuem
  Atendimento clinico vinculado.
- Publicar em stage ou producao sem solicitacao explicita.

## Restricoes

- Abrir um agendamento continua sem criar prontuario involuntariamente.
- A integridade precisa ser garantida no backend e no banco.
- Duplicidades historicas devem interromper a migracao com diagnostico; nenhum
  prontuario ou registro financeiro pode ser descartado automaticamente.
- Notificacoes e auditoria sao efeitos posteriores em best-effort e nao podem
  desfazer uma transacao clinico-operacional ja confirmada.
