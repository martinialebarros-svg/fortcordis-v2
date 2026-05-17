# Plano

1. Refatorar filtros da listagem de agenda para helper reutilizavel sobre query de IDs.
2. Substituir query unica com joins por estrategia em duas fases:
   - `COUNT` e pagina de IDs na tabela `agendamentos`;
   - carga dos relacionados para os IDs retornados.
3. Preservar comportamento de filtros textuais com fallback legado (campos denormalizados).
4. Ajustar testes de custo de query para o novo plano de execucao constante.
5. Executar testes focados de agenda (N+1, filtros por periodo e paginacao estavel).

