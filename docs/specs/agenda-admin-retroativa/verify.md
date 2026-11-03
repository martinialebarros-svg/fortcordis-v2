# Verificacao - agenda-admin-retroativa

Data: 2026-11-03
Responsavel: Codex
Status: implementacao local concluida; homologacao remota aguarda autorizacao.

Base: `origin/stage` em `873a94a5`, worktree isolada, sem alterar o clone principal.

## Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_agenda_alteracao_retroativa_admin.py::test_admin_confirms_past_first_appointment_and_audits_saved_interval`: HTTP 409 inicial, PUT confirmado 200, leitura no SQLite confirma 07h-08h30 e auditoria com autor/antes/depois; sem excecao persistente de rota. | ok |
| CA-002 | acesso | Testes HTTP de nao-admin com flag (403), sem flag (409 nao confirmavel), e sem autenticacao (401); nenhum horario ou auditoria de sucesso persistido em falhas. | ok |
| CA-003 | escopo | Testes de inicio futuro/inalterado (422), futuro sem flag (409), POST e override de rota sem dispensa (409); timestamp UTC convertido no fuso da agenda; nova edicao exige nova confirmacao. | ok |
| CA-004 | regressao | Testes HTTP preservam sobreposicao, agenda fechada, origem/destino georreferenciado e conflito de deslocamento com proximo atendimento. | ok |
| CA-005 | interface | `frontend/app/agenda/NovoAgendamentoModal.retroativa.test.tsx`: 7 testes de aceite, cancelamento, perfil/contrato invalido, confirmacoes independentes e limite de retry. O modal e compartilhado pela agenda principal e FullCalendar. | ok |
| CA-006 | regressao | 292 testes de agenda/migracao de slot/opcoes WhatsApp aprovados, com 91 subtestes; incluem primeira saida, servico iniciado, concorrencia, deslocamento persistente/regional, funcionamento e reserva expirada. | ok |
| CA-007 | homologacao | Confirmar em stage remoto, com registros sinteticos, admin vs nao-admin e auditoria persistida depois de integrar e implantar a feature com autorizacao. | pendente |

## Testes automatizados

Backend, na pasta `backend`:

```bash
/workspace/.venv/bin/python -m pytest -q tests/test_agenda_*.py tests/test_agendamentos_slot_overlap_migration.py tests/test_whatsapp_bot_opcoes_agenda.py
```

Resultado: **292 passed, 91 subtests passed**, 20,01 s. A suite nova contem 14 testes HTTP, incluindo acesso sem autenticacao. Ha avisos de depreciacao existentes de Pydantic/SQLAlchemy/passlib/datetime, sem falhas.

Frontend, na pasta `frontend`:

```bash
npx vitest run app/agenda/NovoAgendamentoModal.retroativa.test.tsx
npx tsc --noEmit
npx eslint app/agenda/NovoAgendamentoModal.tsx app/agenda/NovoAgendamentoModal.retroativa.test.tsx --max-warnings=0
npm test
# Equivalente no Node 20 do CI, com concorrencia limitada a este ambiente:
node node_modules/vitest/vitest.mjs run --maxWorkers=2 && node --test
```

Resultado final no **Node 20.20.2**: **156 arquivos / 2.793 testes Vitest aprovados**, mais **23 testes do runner Node aprovados**, sem skips. Suite nova: **7 passed**. Typecheck completo e lint dos dois arquivos frontend alterados aprovados. `git diff --check` e guardrail SDD aprovados.

Observacao de ambiente: o `npm test` padrao no Node 24 fornecido executou os 2.793 testes Vitest com sucesso, mas o runner nativo passou a descobrir arquivos TypeScript que pertencem ao Vitest, falhando por resolucao de modulos. No Node 20 usado pelo CI, a primeira execucao completa apresentou um timeout de 5 s no teste preexistente `echo-draft-existing-page.test.tsx` (recuperacao da avaliacao de HP), sem alteracao neste diff. A repeticao completa no Node 20 com `--maxWorkers=2` passou integralmente, mantendo o timeout original e sem ignorar testes ou alterar laudos/configuracao global. O runner Node 20 tambem passou separadamente nos 23 testes.

Logs locais da execucao final: `/tmp/fortcordis-admin-retroactive-backend-tests-final.log` e `/tmp/fortcordis-admin-retroactive-frontend-node20-final.log`.

## Testes manuais e limites

- Nao houve teste de navegador contra stage remoto: a implementacao esta em branch local e deploy nao foi autorizado. TestClient valida o contrato HTTP e Testing Library executa as interacoes do modal em jsdom.
- Os testes usam SQLite temporario, dados sinteticos e provedores de rota simulados. Nao usam o atendimento real 1801 nem alteram o banco local de desenvolvimento existente.
- Nenhuma migracao e necessaria; a confirmacao e um campo de requisicao e nao fica salva como permissao reutilizavel.
- Nao houve push, PR publicado, merge, deploy nem acesso a dados de producao.
- Publicar um PR **rascunho** com base `stage` somente depois de autorizado. Merge em stage dispara deploy automatico. Homologar com registros sinteticos, fechar CA-007 e promover por PR `stage -> main` conforme `docs/RUNBOOK-STAGE-PROD.md`.
- **Nao aprovado para producao neste momento**: depende de revisao, integracao/homologacao de stage e autorizacao de promocao. O guard de promocao deve continuar bloqueando enquanto CA-007 estiver pendente.

## Fora do escopo

Nenhum ajuste fora do escopo. O atendimento real da Balli permanece sem alteracao ou verificacao nesta tarefa.
