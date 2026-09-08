# Verify — retornos programados do WhatsApp

Base `3ab6e80437681440353affbf7852268fdee5b4ce`, branch
`codex/whatsapp-retornos-programados`, worktree
`/Users/martiniano/.codex/worktrees/whatsapp-retornos`.

## Evidência executada

- PostgreSQL 16 temporário em 127.0.0.1:55439, banco
  fortcordis_followups_test. Somente fixtures sintéticas, sem credenciais Meta.
- `npm run migrate`: passou; reaplicação do SQL preserva retorno e revisão.
- `npm run test:follow-ups`: passou. Valida entrada, agente inativo, conflito de
  duas gravações, marcação de leitura/fechamento independente, inbound assinado,
  mensagem duplicada, conclusão antiga bloqueada, filtros, meia-noite de Fortaleza,
  versão preservada após término, reagendamento, auditoria e HTTP 401/403/200.
- Regressões backend: conversation-reply-queue, conversation-productivity e
  conversation-ordering passaram; build TypeScript passou.
- Testes UI do painel: agendamento/fuso, validação, nota por conversa, respostas
  atrasadas, conflito, duplo clique, conclusão/cancelamento, recuperação de leitura
  e proteção de gravação contra leitura antiga.
- `npm test` frontend: 31 arquivos Vitest, 227 testes + 9 testes Node = 236
  aprovados. Inclui 11 testes do painel e 3 novos testes de integração da fila.
- `npm run lint`, `npx tsc --noEmit --pretty false` e `npm run build` frontend:
  passaram; 43 páginas geradas. Rota WhatsApp 24,3 kB, first load 160 kB.
- Aviso pré-existente de Browserslist desatualizado, sem falha de build.
- `test:auth-policy`, `test:customer-service-window` e `test:quick-replies`: passaram.
- `git diff --check`, YAML dos dois workflows e guardrail SDD passaram;
  guardrail inclui arquivos modificados e novos não rastreados (21 arquivos).
- Sem smoke autenticado de stage/produção nesta etapa; nenhuma publicação feita.

## Checklist de publicação futura

Aplicar migração antes de trocar o backend. Rodar os novos contratos (incluídos
nos dois quality gates), aguardar deploy terminal e conferir rota autenticada,
contadores, filtros, painel e rotas protegidas 401. Não criar retorno em conversa
real nem enviar mensagem para smoke sem autorização específica.

## Preparação da publicação — 2026-09-08

Usuário autorizou “publique”. Origin/stage e origin/main conferidos em
`3ab6e804`; entrega isolada, sem alterações pendentes de pacientes. Migração
aditiva executada antes do reinício do backend pelo deploy existente. Nenhum
segredo, callback ou envio Meta novo. Resultados terminais de deploy e smoke
serão registrados no relatório de publicação da tarefa.
