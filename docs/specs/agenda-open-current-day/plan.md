# Plan - agenda-open-current-day

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nenhuma alteracao.
- Fase 2 (backend/API): validar que o contrato atual de `/agenda` ja suporta filtro por `data_inicio` e `data_fim`.
- Fase 3 (frontend): inicializar `filtroData` com o dia atual e fechar o periodo inicial da lista no mesmo dia.
- Fase 4 (integracao/observabilidade): executar lint e TypeScript e registrar verificacoes no artefato SDD.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que nao ha migracoes ou mudancas de persistencia.
- [x] T1.2 Confirmar que a entrega e apenas de comportamento frontend.
- Criterio de conclusao: nenhuma alteracao estrutural necessaria.
- Risco: assumir incorretamente dependencia de backend.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 Inspecionar o endpoint `GET /agenda`.
- [x] T2.2 Confirmar que filtro por data ja existe e usa `data_inicio`/`data_fim`.
- Criterio de conclusao: contrato atual confirmado.
- Risco: drift entre comportamento esperado e implementacao real do endpoint.
- Rollback: manter comportamento anterior de frontend se o contrato nao fosse suficiente.

### Fase 3

- [x] T3.1 Inicializar `filtroData` com `hojeLocal()`.
- [x] T3.2 Fazer a visualizacao em lista consultar um intervalo fechado no mesmo dia.
- [x] T3.3 Restaurar `hojeLocal()` quando o input de data vier vazio.
- Criterio de conclusao: agenda abre no dia atual sem consulta ampla.
- Risco: impactar navegacao manual de datas.
- Rollback: reverter o commit em `frontend/app/agenda/page.tsx`.

### Fase 4

- [x] T4.1 Executar `npm exec eslint app/agenda/page.tsx`.
- [x] T4.2 Executar `npx tsc --noEmit`.
- [x] T4.3 Registrar evidencias e decisao de release em `verify.md`.
- Criterio de conclusao: validacoes locais sem erro e documentadas.
- Risco: cobertura manual incompleta do fluxo visual.
- Rollback: reverter o commit se algum smoke test manual detectar regressao.

## 3) Plano de testes

- Testes unitarios: nao aplicavel neste ciclo.
- Testes de integracao: validacao indireta do contrato existente de `/agenda`.
- Testes manuais: abrir `/agenda`, observar carga inicial do dia atual, navegar entre datas e limpar o input de data.

## 4) Dependencias e bloqueios

- Dependencia 1: endpoint `GET /agenda` continuar aceitando `data_inicio` e `data_fim`.
- Dependencia 2: ambiente frontend local compilando normalmente com Next.js atual.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
