# Plano - PERF-12: paginação SQL da fila de Laudos

## Etapas

1. Transformar as fontes de Exames e Agendamentos sem Atendimento em uma união
   SQL que mantenha cada tipo esperado de laudo, inclusive combos.
2. Contar e ordenar essa união no banco, aplicando `offset` e `limit` antes de
   buscar entidades auxiliares ou calcular prazo.
3. Cobrir segunda página, total e presença de `LIMIT/OFFSET` na consulta da
   fila, além da suíte funcional existente.
4. Rodar guardrail SDD, testes focados, lint, TypeScript e build; publicar
   primeiro em stage e validar a aba Pendentes autenticada.

## Rollback

Reverter o commit da otimização. Não há migration nem alteração persistente.
