# Plan - agenda-performance-quality-for47

Data: 2026-05-15  
Responsavel: Codex  
Status: done

## Fases

1. Ajustar a contagem total da listagem para reduzir custo de `count` em query com joins.
2. Adicionar testes de paginação por período cobrindo estabilidade e ausência de duplicidade entre páginas.
3. Adicionar teste de custo de queries com filtros combinados para evitar regressão N+1.
4. Executar suíte focada e registrar evidências em `verify.md`.

## Checklist

- [x] Endpoint atualizado com `count` otimizado.
- [x] Testes de paginação estável adicionados.
- [x] Teste de custo constante de queries adicionado.
- [x] Testes focados executados com sucesso.
- [x] Artefatos SDD completos (`intent`, `plan`, `spec`, `verify`).
