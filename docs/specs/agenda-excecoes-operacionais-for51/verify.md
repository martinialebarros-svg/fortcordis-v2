# Verify - agenda-excecoes-operacionais-for51

Data: 2026-05-21
Responsavel: Martiniano + Codex
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `motivoSemOpcao` obrigatorio no frontend + validacao backend (`motivo` minimo util) | ok |
| CA-002 | aceitacao | `bloquearSalvarNovo` + guardas de submit impedem salvar manual sem concessao para nao-admin | ok |
| CA-003 | aceitacao | botao `Conceder excecao` (admin) seta `excecaoConcedida` e libera data/hora manual | ok |
| CA-004 | aceitacao | acao frontend chama `POST /agenda/assistente/encerramento` com `tipo=solicitacao_excecao` | ok |
| CA-005 | aceitacao | acao frontend chama `POST /agenda/assistente/encerramento` com `tipo=encerramento_sem_agendamento` | ok |
| CA-006 | aceitacao | `handleSubmit` reforca bloqueio no ramo `sem_opcao` sem concessao admin | ok |
| CA-007 | aceitacao | `observacoesFinal` inclui marcador de excecao concedida por admin | ok |
| NFR-002 | nao funcional | backend registra auditoria estruturada (`tipo`, `motivo`, contexto, perfil) | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx app/agenda/page.tsx app/agenda/fullcalendar/page.tsx
cd frontend && npx tsc --noEmit
cd backend && venv/bin/python -m pytest tests/test_agenda_assistente_encerramento.py
```

Resumo dos resultados:
- ESLint: ok.
- TypeScript: ok.
- Pytest (`test_agenda_assistente_encerramento.py`): 4 passed.

## 3) Testes manuais sugeridos (stage)

- Cenario 1: perfil secretaria, recusar ofertas ate `sem_opcao`, informar motivo e validar que salvar permanece bloqueado.
- Cenario 2: perfil secretaria, clicar `Solicitar excecao ao admin e encerrar` e validar encerramento do modal sem agendamento.
- Cenario 3: perfil admin, recusar ofertas ate `sem_opcao`, informar motivo e clicar `Conceder excecao`.
- Cenario 4: apos concessao admin, validar liberacao de data/hora manual e salvamento com sucesso.
- Cenario 5: em `sem_opcao`, clicar `Encerrar sem agendamento` e validar encerramento do modal.

## 4) Regressao e riscos residuais

- Risco residual 1: auditoria registra eventos, mas ainda nao existe dashboard dedicado para acompanhar backlog de solicitacoes de excecao.
- Risco residual 2: motivo estruturado ainda depende de texto livre (sem taxonomia fechada).

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.

## Ciclo de 04/11/2026 — excecao administrativa direta

Base origin/main `5b3864b5`; worktree isolada `agenda-excecao-admin-direta`,
branch `codex/agenda-excecao-admin-direta`. Implementacao e validacao locais
concluidas. Nenhum commit, push, deploy, Google real, mensagem ou registro
operacional alterado neste ciclo.

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| CA-ADM-01 | `NovoAgendamentoModal.excecao-manual.test.tsx`: acesso direto sem chamadas de ofertas, espacos recusados, submissao com motivo e autorizacao | aprovado local |
| CA-ADM-02 | regressao de troca de data, revogacao e troca de servico; `agenda-assistente-excecao.test.ts` | aprovado local |
| CA-ADM-03 | `test_agenda_excecao_primeira_saida_admin.py`: primeira saida inviavel e rota ausente sem/com confirmacao, reuso do escopo e invalidacao por horario; regressao de sugestoes e pisos | aprovado local |
| CA-ADM-04 | modal confirma/cancela 409; cancelamento preserva invalidacao do aceite em `NovoAgendamentoModal.preferencias.test.tsx`; backend confere autor, instante, motivo e auditoria do bloqueio | aprovado local |
| CA-ADM-05 | nao-admin sem botao, 403 para ambas as flags, 422 para motivo vazio e 409 de slot ocupado mesmo com concessao; regressao Agenda | aprovado local |

Comandos executados a partir da worktree (venv e node_modules existentes foram
reutilizados somente como ferramentas, sem copiar alteracoes da checkout suja):

```sh
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m pytest -q backend/tests/test_agenda*.py backend/tests/test_sdd_guardrail.py
cd frontend
node node_modules/vitest/vitest.mjs run
node --test
npm run lint
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

- Backend Agenda + guardrail: **273 aprovados e 82 subtests**, bancos temporarios.
- Foco inicial backend: **47 aprovados e 22 subtests**; incluido na rodada acima.
- Frontend global final: **147 arquivos / 2.597 Vitest + 23 Node aprovados**.
- Foco final da excecao + preferencias: **20 aprovados**; incluido na global.
- ESLint global, TypeScript e build Next (44 paginas estaticas): aprovados.
- `git diff --check` e inspecao do diff: aprovados. Guardrail SDD avaliado com
  a lista real de arquivos modificados/novos por `evaluate_guardrail`, aprovado
  para as duas features deste ciclo; sem fabricar commits para executar o gate.
- A primeira rodada global detectou cancelamento de excecao que perdia o codigo
  do erro e mantinha aceite obsoleto. Corrigido preservando o erro original;
  foco e global finais passaram. Nenhuma falha pendente desta entrega.
- Avisos preexistentes de deprecacao Pydantic/SQLAlchemy, Browserslist antigo e
  navegacao jsdom nao impediram os checks; dependencias nao foram alteradas.

Limites: nao houve smoke de navegador autenticado ou homologacao remota.
Publicar e homologar em Stage e, depois, promover a producao sao passos separados,
ainda nao executados nem autorizados por este pedido. Testes sinteticos nao
comprovam o resultado de um agendamento real.

### Autorizacao de publicacao — 04/11/2026

Apos a validacao local acima, o usuario pediu explicitamente "publique" neste
chat. Publicacao autorizada somente para o incremento de excecao administrativa
descrito aqui, com Stage primeiro, promocao isolada e preservacao dos trabalhos
paralelos. Substitui a ausencia de autorizacao registrada no encerramento local;
nao transforma checks locais em homologacao remota. Preparacao em andamento,
aguardando conclusao da restauracao de Stage pelo Atendimento (PR #554).
