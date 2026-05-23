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
