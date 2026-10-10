# Plan — Edição após conclusão

1. Corrigir a recuperação de rascunho para conservar os metadados autoritativos do atendimento carregado, mantendo o conteúdo clínico digitado.
2. Permitir o fluxo normal de salvar/autosalvar em registros concluídos, sem reabrir o atendimento nem recriar cobranças. Documentos persistidos continuam independentes do formulário do atendimento.
3. Gravar alterações clínicas e auditoria na mesma transação; reutilizar a auditoria transacional já existente dos documentos.
4. Expor histórico autenticado e restrito ao atendimento, com paginação, autor, data e diferenças antes/depois. Exibi-lo no prontuário, com estados de carregamento, vazio e erro recuperável.
5. Ajustar os avisos para apresentar edição direta e adendos opcionais; conservar a informação de que texto atualizado exige novo PDF.
6. Validar recuperação de rascunho obsoleto, edição pós-conclusão, persistência em nova sessão, ausência de mudanças financeiras, falha de auditoria, isolamento do histórico e estados da interface. Executar checagens do repositório e alinhar SDD.

Rollback: reverter o código mantém os eventos já gravados na tabela de auditoria. Não há limpeza nem migração de dados clínicos. Uma reversão reduz as garantias de auditoria clínica e retira a visualização do histórico, portanto deve preservar os eventos existentes.
