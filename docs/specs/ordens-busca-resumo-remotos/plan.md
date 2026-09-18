# Plan

1. Worktree isolada de origin/stage, preservando mudanças do clone principal.
2. Acrescentar busca literal opcional na listagem existente.
3. Acrescentar resumo agregado opt-in na mesma relação filtrada antes de paginar.
4. Testar com 505 registros, relacionamentos ausentes, filtros combinados,
   múltiplas páginas, valores decimais e orçamento de consultas.
5. Validar os testes existentes de OS e guardrail SDD. Não publicar nesta etapa.

Agrupamentos SQL e filtro de detalhes por destinatário implementados e testados.
Interface de Ordens conectada com seleção entre páginas, revalidação de snapshots,
links para OS antigas e testes simulados sem submissão financeira.
Cobranças integrada a grupos remotos e detalhes completos sob demanda, com
cancelamento, limite de leitura e bloqueio em caso de divergência.
Próximo passo: medição autenticada comparativa em stage. Não publicar sem autorização.
