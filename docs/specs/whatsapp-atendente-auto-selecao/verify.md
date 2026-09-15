# Verify - whatsapp-atendente-auto-selecao

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | Teste `pré-seleciona o atendente logado pelo email ao assumir uma conversa sem responsável` em `page.test.tsx`: usuário `Eu@FortCordis.com ` (com espaço/maiúsculas) casa com atendente `eu@fortcordis.com` (id "9") | passou |
| CA-002 | Teste `usa o primeiro atendente ativo quando o email logado não corresponde a nenhum atendente`: sem correspondência, seleciona id "5" (primeiro ativo, pulando o inativo "3") | passou |
| CA-003 | Coberto pelo mesmo teste acima: atendente inativo "3" (mesmo que estivesse antes na lista) nunca é selecionado | passou |

## Comandos executados

```bash
cd frontend
npx eslint app/whatsapp-stage/page.tsx lib/useCurrentUser.ts --max-warnings=0
npx vitest run app/whatsapp-stage/page.test.tsx
npx next build
```

## Resultado final - 2026-08-18

- ESLint direcionado: passou sem avisos.
- Vitest direcionado (`page.test.tsx`): 9 testes passaram (2 novos desta
  feature, mais os 7 já existentes).
- `next build`: passou; rota `/whatsapp-stage` gerada (10.7 kB).

Risco residual: nenhum vínculo persistido entre usuário autenticado e
atendente — a correspondência é só por email, recalculada a cada
carregamento da página.
