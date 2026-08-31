# Verify - stable-catalog-cache-performance

Data: 2026-08-31
Responsavel: Codex / equipe FortCordis
Status: validado localmente

## Matriz de verificacao

| Critério | Evidência planejada | Status |
| --- | --- | --- |
| CA-001 | `stable-catalog-cache.test.ts` cobre reuso dentro do TTL | ok local |
| CA-002 | testes cobrem solicitação concorrente, expiração, falha, mutação e troca de sessão | ok local |
| CA-003 | diff mapeia consumidores de clínicas e serviços, sem incluir dados dinâmicos | ok local |
| CA-004 | testes, lint, TypeScript, build e guardrail SDD | ok local |
| CA-005 | smoke autenticado em stage de Agenda e Financeiro | pendente |

## Comandos de validacao

```bash
cd frontend && npm test
cd frontend && npm run lint -- --quiet
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run build
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

## Evidencia local

- `npm test`: 24 arquivos Vitest e 151 testes, além de 9 testes Node, aprovados.
- `npm run lint -- --quiet`, `npx tsc --noEmit --pretty false` e `npm run build` concluídos; o build gerou 43 rotas.
- `git diff --check` não encontrou problemas; o guardrail SDD aprovou o diff completo contra `origin/stage`, incluindo os quatro artefatos novos.

## Riscos residuais

- A atualização feita por outro operador pode permanecer visível por até cinco minutos se não vier acompanhada de uma mutação nesta sessão.
- O cache não substitui telemetria de latência nem a futura revisão de consultas/banco.

## Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
