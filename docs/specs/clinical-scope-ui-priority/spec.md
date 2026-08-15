# Spec - clinical-scope-ui-priority

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Escopo funcional

Alinhar a interface do Fort Cordis ao escopo clinico atual do produto, priorizando `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial` nas areas de navegacao e nos atalhos operacionais do dia a dia, enquanto `Ultrassonografia Abdominal` deixa de ocupar espaco de destaque.

## 2) Requisitos funcionais (RF)

- RF-001: a navegacao lateral principal nao deve destacar `US Abdominal` como item proprio.
- RF-002: o menu `Laudar` da agenda padrao deve exibir `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial` como opcoes principais.
- RF-003: o menu `Laudar` da agenda FullCalendar deve seguir a mesma priorizacao.
- RF-004: a opcao `Pressao Arterial` deve abrir `Novo Laudo` com contexto dedicado de `PA`.
- RF-005: o fluxo dedicado de `PA` deve abrir diretamente na aba de pressao e marcar o salvamento como laudo de pressao arterial por padrao.
- RF-006: a tela de `Novo Laudo` deve mostrar orientacoes coerentes com `PA` quando aberta nesse modo.
- RF-007: a tela de edicao deve abrir diretamente na aba de pressao ao editar laudos do tipo `pressao_arterial`.
- RF-008: a tela de visualizacao deve exibir cabecalho e resumo compativeis com laudos de `Pressao Arterial`.
- RF-009: as rotas de ultrassonografia podem permanecer ativas, mas nao devem ser ponto de destaque na operacao atual.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (clareza): a interface deve reduzir ruido operacional para o uso atual da Fort Cordis.
- NFR-002 (compatibilidade): os fluxos existentes de `Ecocardiograma`, `Eletrocardiograma` e `Ultrassonografia Abdominal` nao devem ser quebrados.
- NFR-003 (consistencia): agenda padrao e agenda FullCalendar devem expor o mesmo conjunto principal de tipos de laudo.

## 4) Contratos tecnicos

### Frontend

- `frontend/app/layout-dashboard.tsx`
  - remove o destaque lateral de `US Abdominal`.

- `frontend/app/agenda/page.tsx`
  - ajusta o menu `Laudar` para `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial`;
  - encaminha `Pressao Arterial` para `/laudos/novo?tipo=pressao_arterial`.

- `frontend/app/agenda/fullcalendar/page.tsx`
  - replica a mesma priorizacao do menu `Laudar`.

- `frontend/app/laudos/novo/page.tsx`
  - interpreta `tipo=pressao_arterial`;
  - abre o formulario focado em `PA`;
  - deixa `salvar_como_laudo_pressao` ativo por padrao nesse contexto.

- `frontend/app/laudos/[id]/editar/page.tsx`
  - ao editar laudos `pressao_arterial`, abre a aba `Pressao` como contexto inicial.

- `frontend/app/laudos/[id]/page.tsx`
  - ao visualizar laudos `pressao_arterial`, mostra titulo e resumo dedicados ao exame.

## 5) Criterios de aceitacao (CA)

- CA-001: `US Abdominal` nao aparece mais como item proprio no menu lateral.
- CA-002: agenda padrao oferece `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial` no menu `Laudar`.
- CA-003: agenda FullCalendar oferece o mesmo trio no menu `Laudar`.
- CA-004: clicar em `Pressao Arterial` abre `Novo Laudo` em modo dedicado de `PA`.
- CA-005: editar um laudo de `PA` abre diretamente a aba de pressao.
- CA-006: visualizar um laudo de `PA` mostra titulo e resumo coerentes com o exame.
- CA-007: `eslint`, `build` e `git diff --check` passam.

## 6) Fora de escopo

- Remocao definitiva das rotas de `Ultrassonografia Abdominal`.
- Alteracoes no backend de laudos.
- Comercializacao multi-especialidade do produto.
