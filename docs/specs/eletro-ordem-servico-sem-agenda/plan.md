# Plan — OS no upload de eletro sem Agenda

1. Trabalhar em cópia isolada de `origin/stage`, preservando alterações do
   checkout original.
2. Permitir `ordens_servico.agendamento_id` nulo e registrar origem pelo
   `laudo_id`, com migração idempotente que preserve registros e índices.
3. Usar a precificação existente do servidor (negociação da clínica antes
   da tabela), exigir serviço ativo e valor positivo e validar permissão
   de edição de ordens de serviço.
4. Salvar PDF, laudo, OS e auditoria como uma operação atômica; proteger
   repetições da submissão com chave de idempotência e comparação de pedido.
5. Adicionar opção desmarcada, seleção explícita de serviço/horário e
   prévia do preço no upload sem contexto de Agenda/Atendimento. Mostrar a
   OS persistida na visualização do laudo.
6. Proteger vínculo e identidade financeira/clinica contra exclusões ou
   alterações incompatíveis enquanto a OS estiver ativa.
7. Validar upload antigo, nova operação, falhas, repetição, permissões,
   migração, apresentação, Financeiro/portal e guardrail SDD.

## Falha segura e reversão

Uma falha na geração da OS deve reverter laudo e anexo, removendo o arquivo
novo; não informar sucesso parcial. A opção desligada mantém o upload
existente. OS emitidas permanecem no histórico e devem ser canceladas pelo
fluxo financeiro quando necessário; não converter ausência de Agenda em
registro fictício ou apagar cobranças para reverter código. Não aplicar a
migração a bancos de operação nesta entrega.
