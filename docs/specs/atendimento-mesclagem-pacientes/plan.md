# Plan — mesclagem assistida de pacientes

1. Inspecionar os vínculos diretos de paciente, as fronteiras de portal e o fluxo de documentos antes de mover qualquer referência.
2. Adicionar a migração 108, o registro administrativo, os guardas de código arquivado, uma lista explícita de colunas transferíveis e revisão privada. Vínculos fora da lista não são alterados.
3. Montar a prévia com metadados e hash do estado revisado. Confirmar em transação, com aquisição imediata de bloqueios para devolver conflito se outra gravação estiver em curso. Proteger contra reaproveitar o código antigo e manter os documentos no mesmo ID.
4. Ligar a tela a Atendimento e Pacientes. Separar a aba de revisão para preservar rascunhos e consulta. Mostrar a ficha arquivada com acesso ao principal.
5. Validar API, interface, CI de migrações e regressões em bases sintéticas. Publicação e teste autenticado em stage são uma etapa própria.

Se uma confirmação falhar, nenhuma alteração parcial fica gravada. Uma eventual correção após uma confirmação bem-sucedida requer revisão técnica dos códigos registrados no histórico; não reverter por nome nem restaurar uma tabela inteira.
