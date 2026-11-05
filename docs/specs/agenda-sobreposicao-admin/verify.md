# Verificação — 04/11/2026

Implementado localmente na branch `codex/agenda-admin-sobreposicao`, base `origin/main` `4c109329`, worktree `/Users/martiniano/.codex/worktrees/agenda-admin-sobreposicao/fortcordis-v2`.

| Critério | Evidência local | Estado |
| --- | --- | --- |
| RF-001/002: contrato 409 e admin explícito | `test_agenda_sobreposicao_admin.py`: conflito parcial, admin, não-admin/403, motivo vazio/422 e token antigo/409 | aprovado |
| RF-003/005: escopo e persistência | concessão com autor/data/motivo/intervalos auditados; PUT aceita nova revisão; nova ocupação invalida token; rotina mantém concessão existente | aprovado |
| RF-004: confirmação UI | modal testa autorização, cancelamento, ausência da opção para não-admin e nova confirmação após alteração dos conflitos | aprovado |
| RF-006: banco e concorrência | PostgreSQL 16.13 temporário: exclusão comum/23P01, autorização real por POST/PUT, trigger de revogação, adjacência, concorrência (201+409), migração idempotente | aprovado |
| RF-007: invariantes | duração de 45 minutos preservada; bloqueio administrativo não ultrapassado; regressões de Agenda/rota/reservas | aprovado |

## Comandos e resultados

- Backend: `AGENDA_TEST_POSTGRES_URL=<banco temporário dedicado> python -m unittest discover -s backend/tests -t backend -p 'test_agenda*.py' -q`: **290 testes aprovados, sem skips**, incluindo seis de PostgreSQL. Apenas SQLite temporário e PostgreSQL descartável; URL operacional não usada.
- Frontend: `vitest run app/agenda lib/agenda-assistente-excecao.test.ts lib/agenda-shared-actions.test.ts lib/agenda-reabilitar-reserva.test.ts`: **64 testes / 11 arquivos aprovados**.
- `npm run lint`, `tsc --noEmit`, `npm run build`: aprovados; build Next.js com 44 páginas. Aviso de base Browserslist antiga, sem impacto demonstrado neste ciclo.
- `compileall`, `git diff --check` e `evaluate_guardrail` usando diff + arquivos novos não rastreados: aprovados.
- Logs preservados em `output/agenda-sobreposicao-admin-20261104/` (artefatos locais ignorados pelo Git).

A primeira regressão revelou que o PATCH de status esperava erro textual; o contrato antigo foi preservado nesse caminho e a rodada final passou. Fixtures SQL foram corrigidas para fornecer defaults obrigatórios; os testes PostgreSQL verificam SQLSTATE 23P01, não qualquer erro genérico de integridade.

## Uso pela interface e pelo Dot

No modal, admin escolhe horário manual com o motivo existente. Ao salvar um intervalo ocupado, revisa os conflitos exibidos e aciona **Autorizar sobreposição**. A interface reenvia o token específico com a confirmação. O Dot pode operar essa mesma interface usando a sessão admin e a autorização do usuário; este projeto não modifica o próprio Dot nem interpreta a frase “autorizo” no chat externo.

Para cliente HTTP autenticado: obter o 409 do POST/PUT e reenviar os mesmos dados com `confirmar_sobreposicao=true`, `escopo_sobreposicao_confirmado=detail.escopo` e `motivo_excecao_sobreposicao`. `confirmar_conflito_deslocamento` continua separado. O status/reabilitação reutiliza somente a concessão persistida compatível; novos conflitos exigem revisão pelo PUT.

## Limites e publicação

Sem commit, push, deploy, migração remota ou alteração de agendamento/cadastro real. Não há homologação com Dot ou navegador autenticado neste ciclo; interface testada por componentes, API e banco por dados sintéticos. Publicação em Stage/produção é pendência separada.

A exclusão parcial protege pares de slots comuns; a API também verifica slots autorizados sob o lock transacional existente, impedindo nova ocupação comum sobre eles. Escrita SQL privilegiada direta não equivale a usar a API autenticada. A função de trigger é `SECURITY INVOKER`, sem mudança de grants/RLS e sem nova tabela exposta. Migração segue o runner Python existente, sem gerar histórico Supabase paralelo.

Rollback da aplicação preserva a coluna/trilha. Antes de restaurar a exclusão anterior no banco, resolver os conflitos autorizados existentes; não apagar concessões para forçar rollback. Mudança de escopo deve exigir nova revisão. Referência técnica: [exclusion constraints PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION).

## Preparação da publicação em 05/11/2026

Candidata reaplicada sobre produção `efdb0d01`. A migração recebeu o número `20261105_107` após conferência de Stage e produção, que já usam a 106. O preflight de leitura confirmou a restrição anterior e o bloqueio de escritas diretas para `anon` e `authenticated` nos dois bancos.

A revisão acrescentou a confirmação do agendamento original no mesmo escopo e o bloqueio de novas ocupações de um slot autorizado que atravesse a meia-noite. Os testes exercitam a confirmação de status e a rejeição da remarcação sem nova autorização.
