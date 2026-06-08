# Verify - agenda-assistente-governanca-for55

Data: 2026-05-26
Responsavel: Martiniano + Codex
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `NovoAgendamentoModal.tsx` remove auto-`sem_opcao` em zero ofertas e exige oferta exibida para recusa | ok |
| CA-002 | aceitacao | `registrar_encerramento_assistente` valida `total_sugestoes >= 1` | ok |
| CA-003 | aceitacao | `PUT /configuracoes` bloqueia `agenda_excecoes` para nao-admin (403) | ok |
| CA-004 | aceitacao | lock de escrita + teste concorrente de slot (`test_agenda_concorrencia_slot.py`) | ok |
| CA-005 | aceitacao | `POST /agenda/assistente/ofertas` define `data_base`/`origem_data_automatica` no backend | ok |
| CA-006 | aceitacao | modal usa `POST /agenda/assistente/ofertas` para gerar panorama | ok |
| CA-007 | aceitacao | evento `ASSISTENTE_AGENDA_EXCECAO_CONCEDIDA` com motivo/contexto | ok |
| CA-008 | aceitacao | `GET /agenda/assistente/metricas` agrega por etapa/perfil/clinica | ok |
| CA-009 | aceitacao | orquestrador tenta fallback de datas candidatas quando primeira data automatica vem sem ofertas | ok |
| CA-010 | aceitacao | modal libera fluxo retroativo para admin em data passada + zero ofertas; nao-admin segue bloqueado | ok |
| CA-011 | aceitacao | orquestrador hierarquiza ate 3 datas com `data vazia` apenas no fim e varre dias intermediarios entre datas candidatas para nao perder ancoras validas | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && ./venv/bin/python -m pytest -q tests/test_agenda_assistente_orquestrador_metricas.py tests/test_agenda_duracao_servico_create.py tests/test_agenda_concorrencia_slot.py tests/test_agenda_assistente_encerramento.py tests/test_configuracoes_autorizacao.py
cd backend && ./venv/bin/python -m py_compile app/api/v1/endpoints/agenda.py app/api/v1/endpoints/configuracoes.py app/schemas/agendamento.py tests/test_agenda_assistente_orquestrador_metricas.py tests/test_agenda_concorrencia_slot.py tests/test_configuracoes_autorizacao.py
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx --max-warnings=0
```

Resumo:
- Pytest focal agenda: `15 passed`.
- `py_compile`: ok.
- ESLint do modal de agenda: ok.

Execucao adicional deste ciclo (2026-05-26):

```bash
cd backend && source venv/bin/activate && pytest -q tests/test_agenda_assistente_orquestrador_metricas.py
```

Resultado adicional:
- `4 passed` (inclui cobertura dos cenarios de fallback entre datas preferenciais e fallback para data de referencia).

Validacao adicional deste ciclo (frontend):

```bash
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx --max-warnings=0
```

Resultado adicional:
- ESLint local: `ok` para fluxo retroativo controlado em data passada.

Execucao adicional deste ciclo (2026-06-08):

```bash
cd backend && ./venv/bin/python -m py_compile app/api/v1/endpoints/agenda.py tests/test_agenda_assistente_orquestrador_metricas.py tests/test_agenda_sugestao_janela_operacional.py
cd backend && ./venv/bin/python -m pytest -q tests/test_agenda_assistente_orquestrador_metricas.py tests/test_agenda_sugestao_janela_operacional.py
```

Resultado adicional:
- `py_compile`: ok.
- Pytest focal do assistente/orquestrador: `36 passed`.

## 3) Smoke operacional recomendado (FOR-62)

- Cenario 1 (secretaria): gerar melhor oferta, visualizar panorama, aceitar e salvar.
- Cenario 2 (secretaria): sem oferta aderente, registrar motivo e solicitar excecao sem criar agendamento.
- Cenario 3 (admin): sem oferta aderente, conceder excecao, ajustar manual e salvar.
- Cenario 4 (concorrencia): tentar criar mesmo slot em duas abas e validar que uma operacao falha por indisponibilidade.
- Cenario 5 (metricas): consultar `GET /agenda/assistente/metricas` e validar contadores por etapa/perfil.

## 4) Riscos residuais

- Risco residual 1: metricas estao disponiveis por endpoint, mas ainda sem dashboard visual dedicado.
- Risco residual 2: cobertura de concorrencia foi validada localmente com SQLite; em Postgres o lock e advisory por transacao e depende da disciplina de uso dos endpoints oficiais.
- Risco residual 3: a terceira data vazia depende do horizonte pesquisado; em agendas muito preenchidas ela pode nao aparecer antes do limite de busca progressiva.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
