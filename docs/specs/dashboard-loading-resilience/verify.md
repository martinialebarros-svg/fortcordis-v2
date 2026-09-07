# Verify - dashboard-loading-resilience

Data: 2026-09-07
Responsável: Codex / equipe FortCordis
Status: validado localmente

## Matriz de verificação

| Critério | Evidência | Status |
| --- | --- | --- |
| CA-001 | `page.test.tsx` verifica quatro chamadas iniciadas na mesma carga | ok local |
| CA-002 | `page.test.tsx` simula timeout de Pacientes preservando Clínicas e Serviços | ok local |
| CA-003 | `dashboard-loading.test.ts` cobre sucesso, falha e cancelamento tardio | ok local |
| CA-004 | `page.test.tsx` confirma retry somente para `/pacientes` | ok local |
| CA-005 | 156 Vitest + 9 Node, lint, TypeScript, build e guardrail SDD | ok local |

## Validações executadas

```bash
cd frontend
npm exec vitest run lib/dashboard-loading.test.ts app/dashboard/page.test.tsx  # 5 testes aprovados
npx tsc --noEmit --pretty false                                                # aprovado
npm test                                                                       # 156 Vitest + 9 Node aprovados
npm run lint                                                                   # aprovado
npm run build                                                                  # aprovado, 43 rotas
```

`git diff --check` não encontrou erro de whitespace. O guardrail SDD foi executado contra `origin/main` e aprovou a feature `dashboard-loading-resilience`.

## Smoke planejado

1. Abrir Dashboard autenticado com todas as APIs disponíveis.
2. Interromper uma leitura segura e confirmar que as demais métricas permanecem visíveis, com valor desconhecido apenas na seção afetada.
3. Acionar a nova tentativa e confirmar que somente a seção falha é solicitada novamente.
4. Navegar para outra rota durante a carga e confirmar que uma resposta tardia não atualiza o Dashboard desmontado.

## Limitação conhecida

O timeout de conexão antes do TLS não é observado pelo backend; a investigação de Nginx/SO/rede na VPS continua necessária para eliminar a causa do incidente.
