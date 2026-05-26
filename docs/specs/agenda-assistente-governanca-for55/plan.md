# Plan - agenda-assistente-governanca-for55

Data: 2026-05-26  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): sem migracao obrigatoria; manter compatibilidade com schema atual.
- Fase 2 (backend/API): orquestrador unico de ofertas, autorizacao de excecao e telemetria de funil.
- Fase 3 (frontend): fluxo guiado obrigatorio, desfechos de excecao e lancamento retroativo controlado.
- Fase 4 (integracao/observabilidade): smoke operacional e consolidacao de evidencias no ciclo.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar ausencia de migracoes obrigatorias para o escopo.
- [x] T1.2 Validar compatibilidade dos campos de excecao operacional.
- Criterio de conclusao: backend executa sem delta de schema obrigatorio.
- Risco: baixo.
- Rollback: n/a (sem alteracao estrutural).

### Fase 2

- [x] T2.1 Consolidar endpoint `POST /agenda/assistente/ofertas` com fallback deterministico de datas.
- [x] T2.2 Reforcar autorizacao/admin em excecoes operacionais e trilha auditavel.
- Criterio de conclusao: testes backend de agenda/funil passando no escopo focal.
- Risco: medio.
- Rollback: revert dos commits de backend + restaurar comportamento anterior do orquestrador.

### Fase 3

- [x] T3.1 Bloquear bypass de `sem_opcao` sem oferta exibida.
- [x] T3.2 Implementar liberacao de lancamento retroativo para admin quando data passada nao retorna oferta.
- Criterio de conclusao: fluxo guiado consistente no modal com regras por papel.
- Risco: medio.
- Rollback: revert dos commits frontend do modal de agenda.

### Fase 4

- [x] T4.1 Rodar smoke de cenarios chave (aceite, sem opcao, admin excecao, data passada).
- [x] T4.2 Atualizar SDD (`spec.md`, `verify.md`, `intent.md`, `plan.md`) no mesmo ciclo.
- Criterio de conclusao: guardrail SDD e pipeline de stage aprovados.
- Risco: medio.
- Rollback: segurar deploy e reaplicar patch de docs/fluxo.

## 3) Plano de testes

- Testes unitarios: suite focal de agenda no backend (orquestrador/metricas/concorrencia/duracao).
- Testes de integracao: validacao de endpoint de ofertas com fallback e fluxo de excecao.
- Testes manuais: smoke operacional em stage/local para secretaria e admin, incluindo data passada.

## 4) Dependencias e bloqueios

- Dependencia 1: permissao de admin corretamente mapeada no ambiente de teste.
- Dependencia 2: pipeline de deploy com guardrail SDD ativo e consistente.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
