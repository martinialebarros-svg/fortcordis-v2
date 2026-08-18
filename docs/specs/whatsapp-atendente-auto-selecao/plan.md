# Plan - whatsapp-atendente-auto-selecao

## Fase 1 - hook e integração

- [x] P1.1 criar `frontend/lib/useCurrentUser.ts` lendo `localStorage.user`
  com parse defensivo;
- [x] P1.2 usar o hook em `whatsapp-stage/page.tsx`, calcular `myAgentId`
  (atendente ativo com email correspondente) via `useMemo`;
- [x] P1.3 substituir o fallback `agents[0]?.id` por
  `myAgentId || agents.find(active)?.id` no `useEffect` de
  `agentActionId`.

## Fase 2 - verificação

- [x] P2.1 testes de componente cobrindo correspondência por email e
  fallback sem correspondência;
- [x] P2.2 `tsc --noEmit`, ESLint direcionado, `next build`, `vitest run`.

## Rollback

- Reverter o `useEffect` para `agents[0]?.id` e remover o import do hook
  restaura o comportamento anterior. Sem migração, sem mudança de contrato
  de API.
