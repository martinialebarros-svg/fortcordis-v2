# Verify - date-only-timezone

Data: 2026-08-02
Responsavel: Equipe Fort Cordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| DO-001 | regressao | `test_parse_data_exame_preserves_calendar_date_in_operational_timezone` | ok |
| DO-002 | frontend | `frontend/lib/calendar-date.ts` aplicado a laudos e upload de eletrocardiograma | ok |
| DO-003 | portal | workspaces de clinica, parceiro e tutor exibem `data_realizacao` como data de calendario | ok |
| DO-004 | financeiro/fiscal | transacoes, recibos, cobrancas e periodo fiscal usam o dia operacional | ok |
| DO-005 | regressao | build e verificacao de tipos do frontend | ok |

## 2) Validacoes executadas

```bash
DATABASE_URL=sqlite:////private/tmp/fortcordis-date-only-tests.sqlite \
  backend/venv/bin/python -m unittest tests.test_laudo_portal_release -v

backend/venv/bin/python -m py_compile app/api/v1/endpoints/laudos.py

cd frontend && npx eslint \
  app/atendimento/page.tsx \
  lib/calendar-date.ts \
  app/laudos/page.tsx \
  'app/laudos/[id]/page.tsx' \
  app/laudos/novo/page.tsx \
  'app/laudos/[id]/editar/page.tsx' \
  app/laudos/eletrocardiograma/upload/page.tsx \
  components/portal/PortalClinicaWorkspace.tsx \
  components/portal/PortalPartnerWorkspace.tsx \
  components/portal/PortalExamResults.tsx \
  app/financeiro/TransacaoModal.tsx \
  app/financeiro/page.tsx \
  app/financeiro/relatorios/page.tsx \
  app/financeiro/frota/page.tsx \
  app/ultrassonografia-abdominal/page.tsx \
  'app/ultrassonografia-abdominal/[id]/page.tsx' \
  app/ultrassonografia-abdominal/components/UltrassonografiaAbdominalForm.tsx \
  app/configuracoes/page.tsx \
  app/fiscal/components/ExportacaoDadosContabeisPage.tsx \
  app/relatorios/formatters.ts \
  'app/pacientes/[id]/page.tsx' \
  lib/paciente.ts \
  --max-warnings=0

cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run build
```

Resultados:

- `tests.test_laudo_portal_release`: 12 testes aprovados, incluindo a regressao da data de exame.
- `py_compile`, ESLint, TypeScript e build do Next.js: aprovados.
- Auditoria estatica: nenhum uso restante de `new Date("YYYY-MM-DD")` nos campos de data de exame, realizacao, vencimento, transacao ou nascimento; horarios de agenda seguem usando seus helpers proprios.

## 3) Cenarios manuais

1. Em Laudos, envie um PDF de eletrocardiograma com data de exame `25/07/2026`.
2. Confirme que a pagina de visualizacao e a lista exibem `25/07/2026`.
3. Libere o laudo para uma clinica e confirme a mesma data no portal da clinica e, quando aplicavel, no portal do veterinario parceiro e do tutor.
4. Repita o teste no periodo noturno, quando a conversao UTC antes podia antecipar ou atrasar o dia exibido.

## 4) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
