# Verify - dashboard-mobile-notification-clearance

Data: 2026-08-11
Responsavel: Codex
Status: validado localmente

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | Inspecao das tres rotas: avisos usam `top-[calc(env(safe-area-inset-top)+4.5rem)]` no mobile, reservando a faixa do cabecalho. | ok |
| CA-002 | Inspecao das tres rotas: o modificador `lg:top-4` preserva a posicao desktop. | ok |
| CA-003 | `npm run lint`, `npx tsc --noEmit` e `npm run build` concluidos com sucesso em 2026-08-11. | ok |

## Risco residual

- A confirmacao visual em um dispositivo fisico com notch continua recomendada para conferir a area segura real; a regra usa `env(safe-area-inset-top)` para cobrir esse caso.
