# Verify - atendimento-agenda-transactional-finalization

Data: 2026-07-29
Responsavel: Codex
Status: done

## Matriz de rastreabilidade

| Criterio | Evidencia planejada | Status |
| --- | --- | --- |
| CA-001/CA-002 | sucesso com um commit e rollback por prontuario/preco invalido | ok |
| CA-003 | repeticao idempotente com uma unica OS | ok |
| CA-004 | segunda criacao para o mesmo agendamento retorna 409 | ok |
| CA-005/CA-006 | migracao em base integra e falha diagnostica sem exclusao | ok |
| CA-007 | vinculo incompatível e Agenda terminal preservam os estados | ok |
| CA-008 | finalizacao sem Agenda conclui apenas o prontuario | ok |
| CA-009 | ESLint, TypeScript, build e smoke autenticado | ok |
| CA-010 | realizacao e reabertura isoladas ficam bloqueadas | ok |

## Validacoes planejadas

```bash
backend/venv/bin/python -m unittest \
  backend/tests/test_atendimento_clinical_lifecycle.py \
  backend/tests/test_atendimento_transactional_finalization.py \
  backend/tests/test_atendimento_transactional_finalization_migration.py \
  backend/tests/test_fiscal_exportacao_consolidada.py

cd frontend
npx eslint app/atendimento/page.tsx \
  app/atendimento/components/AtendimentoConsultaOverviewSection.tsx \
  app/agenda/page.tsx
npx tsc --noEmit --pretty false
npm run build

git diff --check
```

## Resultados

- Regressao direcionada: 26 testes aprovados, incluindo:
  - sucesso com exatamente um `commit`;
  - rollback por conteudo clinico incompleto e preco ausente;
  - repeticao com a mesma OS;
  - OS cancelada seguida de uma nova OS ativa;
  - Agenda terminal, paciente divergente e atendimento sem Agenda;
  - duplicidade de Atendimento;
  - bloqueio de realizacao e reabertura isoladas;
  - migracao integra e diagnostico de duplicidades sem apagar registros;
  - fixture fiscal ajustada para o novo invariante.
- Suite backend sem o teste de ciclo global bloqueado pela migracao alheia:
  506 testes aprovados.
- Suite de Agenda executada separadamente: 92 testes aprovados.
- ESLint direcionado: aprovado.
- TypeScript: aprovado.
- Build Next.js: aprovado, 39 paginas geradas; `/atendimento` com 179 kB e
  `/agenda` com 184 kB no relatorio.
- `git diff --check`: aprovado.
- Smoke autenticado em copia isolada:
  - o contexto da Agenda #7 abriu com paciente, clinica, horario e vinculo;
  - `Concluido` apareceu bloqueado no seletor comum;
  - a tentativa em horario de plantao sem preco retornou 422 e preservou
    Atendimento aberto, Agenda sem realizar e zero OS;
  - a repeticao em horario comercial concluiu o Atendimento #3, realizou a
    Agenda #7 e gerou a OS `OS2026070001` por R$ 180,00;
  - a confirmacao repetida reutilizou a mesma OS;
  - a inspecao do banco confirmou uma OS ativa, `consulta_concluida=1`,
    Agenda `Realizado` e auditoria dos dois modulos.
- A copia temporaria usada no smoke foi enviada para a Lixeira; o banco local
  original nao foi alterado.

## Bloqueio externo observado

O teste global `test_migration_ci_cycle` continua bloqueado antes de chegar a
esta feature porque o arquivo nao pertencente a este pacote
`backend/migrations/versions/20260730_58_portal_partner_auth.py` define
`upgrade(connection)` enquanto o runner chama `upgrade(connection, dialect)`.
O arquivo pertence ao trabalho de Portal ja presente no workspace e nao foi
alterado por esta entrega.

## Riscos residuais

- Duplicidades historicas precisam de conciliacao humana antes da migracao.
- A finalizacao legada de Agendas sem prontuario permanece disponivel por
  compatibilidade com servicos nao clinicos.
- A reabertura de Atendimento vinculado fica bloqueada ate existir uma
  operacao inversa que desfaça prontuario, Agenda, OS e recebimentos com
  seguranca.
- Auditoria detalhada de alteracoes campo a campo continua em etapa futura.
