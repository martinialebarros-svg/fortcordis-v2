# Verify - meta-app-publication

Data: 2026-08-12
Responsavel: Martiniano + Codex
Status: stage-and-meta-publication-passed

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `npm run build` gerou `/privacidade`, `/termos` e `/exclusao-de-dados` como rotas estaticas | passou |
| CA-002 | smoke HTTPS anonimo nas tres rotas de stage | passou no commit `6108c491` |
| CA-003 | revisao do conteudo de `privacidade/page.tsx` | passou por inspecao |
| CA-004 | revisao do conteudo de `termos/page.tsx` | passou por inspecao |
| CA-005 | revisao do conteudo de `exclusao-de-dados/page.tsx` | passou por inspecao |
| CA-006 | URLs legais, dominio e categoria salvos no app Meta `975334532125008` | passou por verificacao visual |
| CA-007 | app alterado para o modo publicado | passou; Meta exibiu confirmacao de publicacao |

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
- Deploy to Stage `31654106080` e Migration CI `31654106062` terminaram com sucesso no commit `6108c491`.
- `https://stage.fortcordis.com.br/privacidade` retornou `200`.
- `https://stage.fortcordis.com.br/termos` retornou `200`.
- `https://stage.fortcordis.com.br/exclusao-de-dados` retornou `200`.
- O app Meta usa o dominio `stage.fortcordis.com.br`, as tres URLs publicas acima e a categoria `Mensagens`.
- A Meta confirmou que todas as configuracoes necessarias estavam concluidas e publicou o app com sucesso.
