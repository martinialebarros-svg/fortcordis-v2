# Plan - atendimento-herdar-dados-anteriores

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (investigacao): concluida - mapeado o estado atual de
  `iniciarNovoAtendimentoPaciente`, os dois pontos de entrada de
  "usar historico", o payload de `/historico` vs `/atendimentos/{id}`, e o
  padrao de confirmacao/banner ja usado no arquivo.
- Fase 2 (core): estender `iniciarNovoAtendimentoPaciente` com o parametro
  `dadosClinicos`, criar `herdarAtendimentoAnterior`, novo estado
  `dadosClinicosOrigem`.
- Fase 3 (UI): trocar o botao existente para usar a nova funcao; adicionar
  o novo botao no Historico recente; adicionar o banner informativo.
- Fase 4 (verificacao): build do frontend, revisao adversarial, roteiro
  manual (sem test runner de frontend).

## 2) Tarefas por fase

### Fase 2 - Core

- [ ] T2.1 Adicionar parametro `dadosClinicos` a
  `iniciarNovoAtendimentoPaciente` (frontend/app/atendimento/page.tsx) e
  aplicar os 4 campos no objeto `next`.
- [ ] T2.2 Novo estado `dadosClinicosOrigem` (mesmo shape de
  `PrescricaoOrigem`), setado/limpo junto com `prescricaoOrigem` dentro de
  `iniciarNovoAtendimentoPaciente`.
- [ ] T2.3 Nova funcao `herdarAtendimentoAnterior(atendimentoId)`: guards +
  confirm especifico + fetch de detalhe + montagem de
  `PrescricaoHistorica`/`AtendimentoHistorico` a partir do detalhe + chamada
  a `iniciarNovoAtendimentoPaciente` com os 3 argumentos.
- Criterio de conclusao: `npx tsc --noEmit` sem erro.
- Risco: baixo - mudanca aditiva, sem tocar nos callers existentes de
  `iniciarNovoAtendimentoPaciente` que nao passam o novo parametro.
- Rollback: reverter o commit.

### Fase 3 - UI

- [ ] T3.1 `AtendimentoPrescricaoHistorySection.tsx`: trocar o `onClick` do
  botao "Usar em novo atendimento" para `herdarAtendimentoAnterior(atendimento.id)`.
- [ ] T3.2 `AtendimentoClinicalRadarAside.tsx`: adicionar botao "Herdar para
  novo atendimento" (ou label equivalente) em cada card do "Historico
  recente", chamando `herdarAtendimentoAnterior(atendimento.id)`. Passar
  `herdarAtendimentoAnterior` como nova prop no render de
  `<AtendimentoClinicalRadarAside />` em `page.tsx`.
- [ ] T3.3 `AtendimentoConsultaEditorSection.tsx`: banner informativo
  quando `dadosClinicosOrigem` presente (prop nova), mesmo estilo visual do
  banner de `prescricaoOrigem`.
- Criterio de conclusao: `npm run build` aprovado.
- Risco: baixo - mudancas isoladas em 3 componentes "props bag"
  (`LooseAtendimentoComponentProps`), sem mudar assinatura de tipos
  compartilhados de forma estrita (tudo `any`).
- Rollback: reverter o commit.

### Fase 4 - Verificacao

- [ ] T4.1 `npm run build` aprovado (typecheck + lint + build).
- [ ] T4.2 Revisao adversarial (agentes independentes) confirmando: os 4
  campos sao herdados corretamente; diagnostico/plano/triagem NUNCA sao
  herdados; os guards existentes de `iniciarNovoAtendimentoPaciente`
  continuam funcionando; o botao do historico de receitas nao regride para
  atendimentos sem os novos campos.
- [ ] T4.3 Roteiro manual (sem test runner de frontend) - documentado no
  `verify.md`.
- Criterio de conclusao: `verify.md` com evidencia dos CAs.
- Risco residual: sem cobertura automatizada de frontend - qualquer
  regressao so aparece em uso real ou revisao de codigo.

## 3) Plano de testes

- Sem test runner de frontend no projeto - `npx tsc --noEmit` + `npm run
  build` + revisao adversarial (leitura de codigo) + roteiro manual
  documentado no `verify.md`.
- Sem mudanca de backend - nenhum teste pytest novo necessario.

## 4) Dependencias e bloqueios

- Depende de `GET /atendimentos/{id}` (`_montar_detalhe_atendimento`), ja
  existente e estavel - nenhuma mudanca necessaria la.
- Nenhum bloqueio de infraestrutura identificado.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
