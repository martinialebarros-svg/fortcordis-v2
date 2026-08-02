# Plan - date-only-timezone

Data: 2026-08-02
Responsavel: Equipe Fort Cordis
Status: done

## 1) Sequencia de fases

- Fase 1: mapear conversoes de data e separar datas de calendario de timestamps.
- Fase 2: centralizar a regra de calendario e corrigir API e telas afetadas.
- Fase 3: criar regressao e executar validacoes locais.
- Fase 4: publicar em stage e realizar smoke test operacional.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Identificar o fluxo de upload e visualizacao de eletrocardiograma.
- [x] T1.2 Auditar usos de `new Date("YYYY-MM-DD")` e conversoes para `toISOString()` em campos de calendario.
- Criterio: pontos com risco de deslocamento de dia identificados.

### Fase 2

- [x] T2.1 Criar helper de data de calendario no frontend.
- [x] T2.2 Interpretar datas de exame sem horario em `America/Fortaleza` no backend.
- [x] T2.3 Aplicar o helper a laudos, portais, financeiro, fiscal, pacientes, configuracoes e ultrassonografia.
- Criterio: o dia selecionado permanece igual ao exibido.

### Fase 3

- [x] T3.1 Adicionar teste de regressao para a data do exame.
- [x] T3.2 Executar testes de backend, lint, TypeScript e build.
- [x] T3.3 Atualizar `intent.md`, `spec.md`, `plan.md` e `verify.md`.
- Criterio: validacao local aprovada e SDD completo.

### Fase 4

- [x] T4.1 Commit e push para `stage` (`dc9d0deb`).
- [x] T4.2 Aguardar `quality-gate`, `sdd-guardrail`, `Migration CI` e deploy da VPS.
- [x] T4.3 Executar smoke externo no portal de laudos em stage.
- Criterio: build servido com a regra de calendario de Fortaleza; a conferencia autenticada de um laudo real fica indicada no `verify.md`.

## 3) Plano de testes

- Backend: teste de parsing de `YYYY-MM-DD` como meia-noite em Fortaleza e suite de liberacao de laudos.
- Frontend: ESLint focal, `npx tsc --noEmit --pretty false` e `npm run build`.
- Manual em stage: enviar ou abrir um laudo de eletrocardiograma com data conhecida e conferir lista, documento e portal autorizado.

## 4) Dependencias e bloqueios

- Dependencia: workflows de `Deploy to Stage (VPS)` e secrets do ambiente stage.
- Bloqueio potencial: o `origin/stage` pode ter mudado depois da validacao local; o SHA deve ser confirmado imediatamente antes do push.
