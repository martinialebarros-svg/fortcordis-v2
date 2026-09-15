# Plan — fila de respostas WhatsApp

1. Estender consulta de conversas com pendência e início da espera, mantendo
   o filtro de não lidas e a ordenação legada. Adicionar marco de fechamento.
2. Reabrir conversas apenas em mensagens recebidas novas. Proteger fechamento
   e assumir sem dono contra alterações concorrentes.
3. Criar cadastro de frases compartilhadas, migração idempotente, validação,
   controle de versão na edição e mesma autorização das APIs da central.
4. Integrar filtros, total acionável, tempo de espera, ações de atendimento e
   biblioteca com busca/categorias/atalhos, sem envio automático.
5. Validar contratos reais em PostgreSQL temporário e UI com fixtures/mocks;
   executar regressões, lint, tipos, builds, inspeção visual e guardrail SDD.

## Migração e retorno

`migrate.ts` aplica `init.sql` e `quick-replies.sql` na mesma transação. As
adições são compatíveis com o código anterior: coluna nullable, índices e
uma tabela nova. Seeds têm identidade estável e não sobrescrevem edição,
renomeação ou desativação. Retornar ao código anterior preserva esses dados;
não remover tabela/coluna para reverter a interface. A migração completa em
transação pode bloquear escrita durante criação de índices em bases grandes;
a publicação deve considerar volume e janela de manutenção.
