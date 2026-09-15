# Plan - portal-clinica-parceira-redesign

Data: 2026-08-14
Responsavel: Martiniano Barros
Status: in-progress (fases 1-3 executadas; login real de clinica parceira testado em 2026-08-16, ver T3.3 - falta so validar o cap de 30 candidatos contra volume real de producao, ver verify.md secao "Regressao e riscos residuais")

## 1) Sequencia de fases

- Fase 1 (backend - campo aditivo): expor `operational_pending_items` sem o cap compartilhado de 8, reaproveitando as queries ja existentes em `_build_clinic_operational_panel`.
- Fase 2 (frontend - reestruturacao do workspace): consolidar KPIs, destacar pendentes, estado vazio.
- Fase 3 (validacao): build, typecheck, lint, teste manual nos dois modos (real + espelho) e mobile.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Em `backend/app/api/v1/endpoints/portal.py`, dentro de `_build_clinic_operational_panel` (635-845), calcular a lista de itens `aguardando_liberacao` sem aplicar o cap compartilhado de 8 usado em `operational_items` - reaproveitando as mesmas queries de `Laudo`/`Exame` ja filtradas por `clinic_filter`.
- [x] T1.2 Adicionar `operational_pending_items: list[PortalClinicOperationalItemResponse]` a `PortalExamListResponse` (schema em `backend/app/schemas/portal.py:82-103`).
- [x] T1.3 Espelhar o campo novo em `frontend/lib/portal-api.ts:322-344` (tipo TS).
- [x] T1.4 Definir o cap proprio do campo novo: `_PORTAL_OPERATIONAL_PENDING_CANDIDATE_LIMIT = 30` candidatos por origem (laudo/exame externo) antes do filtro por `status_key == "aguardando_liberacao"`, sem paginacao - documentado em `portal.py`.
- [x] T1.5 Estendido `test_portal_access_foundation.py` com `test_clinica_operational_pending_items_survive_recent_activity_crowding`, provando que um pendente antigo (fora do top-8 misturado) aparece em `operational_pending_items` (prova de CA-007). 12/12 testes do arquivo passam.
- Criterio de conclusao:
  - endpoint retorna `operational_pending_items` completo e testado, sem alterar nenhum campo existente.
- Risco:
  - query adicional duplicar carga se nao reaproveitar o que `_build_clinic_operational_panel` ja calcula.
- Rollback:
  - remover o campo novo do schema/response; nenhuma migracao a desfazer.

### Fase 2

- [x] T2.1 Em `frontend/components/portal/PortalClinicaWorkspace.tsx`, consolidadas as 2 fileiras de KPI (antigas 613-653 e 4 cards operacionais em 655+) numa unica secao "Resumo da unidade" (7 indicadores compactos), com "Aguardando liberacao" destacado em secao propria acima (RF-001, RF-004).
- [x] T2.2 `operational_pending_items` renderizado com paciente/tutor/tipo de exame/data de realizacao/previsao de liberacao (RF-002).
- [x] T2.3 Estado vazio positivo adicionado, diferenciando "clinica nova sem historico" de "sem pendencias, tudo em dia" via `isNewClinicWithNoHistory` (RF-007, CB-002).
- [x] T2.4 Nenhum texto da nova secao usa 2a pessoa - segue o padrao neutro ja usado no resto do componente (CB-003).
- [x] T2.5 Responsivo conferido via medicao de geometria (375px de largura): sem overflow horizontal (`document.scrollWidth === innerWidth`), grid dos itens pendentes colapsa para 1 coluna (NFR-006).
- Criterio de conclusao:
  - tela abre com pendentes em destaque, lista completa "Exames liberados" inalterada, nenhum dos 8 valores antigos removido.
- Risco:
  - simplificar demais e esconder um numero que a clinica ja usa sem perceber.
- Rollback:
  - reverter `PortalClinicaWorkspace.tsx` para a versao anterior do arquivo.

### Fase 3

- [x] T3.1 Lint/typecheck/build do frontend rodados - `tsc --noEmit`, `eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts` e `npm run build` sem erros.
- [x] T3.2 Testes de backend do portal rodados - 12/12 verdes (`test_portal_access_foundation.py`).
- [x] T3.3 Testado manualmente via `/clinicas/portal/espelho` (login admin local `admin@fortcordis.com`), com um laudo sintetico temporario (status `Finalizado`, sem exame liberado) inserido e removido logo apos o teste - confirmado destaque de "Aguardando liberacao" com contagem e dados do item, "Resumo da unidade" com os 7 indicadores secundarios, "Atividade recente" preservando o item com status badge, e o estado vazio "tudo em dia" para uma clinica sem pendencias. **Testado em 2026-08-16**: login real de uma clinica parceira via `/clinica-parceira` (Clinica #8 em stage - convite -> ativacao -> senha -> login com MFA, sessao real confirmada por decode do JWT). Layout bateu com o espelho, mas o carregamento de exames expos um 500 real (bug de schema, `exames.created_at` como texto no Postgres) - diagnosticado e corrigido, ver `docs/specs/portal-clinica-exame-created-at-fix/`. Reverificado ao vivo apos o fix: exames carregando normalmente.
- [x] T3.4 Viewport mobile (375px) conferido via medicao de geometria (JS): sem overflow horizontal, grid dos itens pendentes em coluna unica.
- Criterio de conclusao:
  - build/testes verdes + verificacao visual manual dos dois modos (espelho e sessao real) e do mobile. **Atingido**.
- Risco:
  - ambiente local sem dado de exemplo de producao para os cenarios reais (`aguardando_liberacao` de verdade) - contornado nesta sessao inserindo e removendo um registro sintetico so para a verificacao visual; a prova funcional de CA-007 (pendente antigo sobrevive ao top-8) ja esta coberta pelo teste automatizado T1.5, que roda em banco isolado.
- Rollback:
  - reverter `PortalClinicaWorkspace.tsx` para a versao anterior do arquivo; o campo de backend pode ficar (aditivo).

## 3) Plano de testes

- Testes automatizados:
  - `backend/venv/bin/python -m unittest backend/tests/test_portal_access_foundation.py`
  - `cd frontend && npx eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts`
  - `cd frontend && npx tsc --noEmit --pretty false`
  - `cd frontend && npm run build`
- Testes manuais:
  - abrir `/clinica-parceira` com sessao de uma clinica com exames pendentes - conferir destaque e dados de cada pendente;
  - abrir `/clinica-parceira` com uma clinica sem pendencias - conferir estado vazio positivo;
  - abrir `/clinicas/portal/espelho` selecionando a mesma clinica - conferir que a visao bate com a real;
  - redimensionar pra viewport mobile e repetir a checagem visual;
  - usar a lista "Exames liberados" com busca/filtro/ordenacao - conferir que nada mudou.

## 4) Dependencias e bloqueios

- Dependencia 1: ambiente local com backend + frontend rodando e dados de exemplo de ao menos 1 clinica com pendencias e atividade recente suficiente pra exercitar CB-004/CA-007.
- Dependencia 2: nenhuma - sem migracao, sem feature flag, sem servico externo novo.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, dado sintetico temporario para o cenario de pendencias - ver risco da Fase 3).
