# Verify - meta-app-publication

Data: 2026-08-12
Responsavel: Martiniano + Codex
Status: local-validation-passed

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `npm run build` gerou `/privacidade`, `/termos` e `/exclusao-de-dados` como rotas estaticas | passou |
| CA-002 | smoke HTTPS anonimo nas tres rotas de stage | pendente de deploy |
| CA-003 | revisao do conteudo de `privacidade/page.tsx` | passou por inspecao |
| CA-004 | revisao do conteudo de `termos/page.tsx` | passou por inspecao |
| CA-005 | revisao do conteudo de `exclusao-de-dados/page.tsx` | passou por inspecao |

## Verificacoes locais e smoke planejado

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
python3 scripts/ci/check_sdd_guardrail.py --base-sha <base> --head-sha <head>
curl -I https://stage.fortcordis.com.br/privacidade
curl -I https://stage.fortcordis.com.br/termos
curl -I https://stage.fortcordis.com.br/exclusao-de-dados
```

## Resultados locais

- TypeScript (`npx tsc --noEmit`): passou.
- ESLint (`npm run lint -- --max-warnings=0` via script do projeto): passou sem avisos.
- Next.js (`npm run build`): passou; 43 paginas geradas, incluindo as tres rotas publicas.
- Revisao de privacidade: nenhum segredo, identificador de paciente ou dado de tutor foi incorporado ao conteudo.
- Smoke HTTPS de stage permanece pendente do deploy deste commit.
