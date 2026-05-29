# Verify - agenda-renderizacao-slots-configuravel

Data: 2026-05-28
Responsavel: Martiniano + Codex
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `slot_interval_min` aplicado em `agenda/page.tsx` e `agenda/fullcalendar/page.tsx` | ok |
| CA-002 | aceitacao | `use_custom_window` + `window_start/window_end` aplicados no FullCalendar e panoramica | ok |
| CA-003 | aceitacao | fallback automatico para janela derivada de `agenda_semanal` quando `use_custom_window=false` | ok |
| CA-004 | aceitacao | `NovoAgendamentoModal` envia `intervalo_minutos={intervaloSlotMinutos}` | ok |
| CA-005 | aceitacao | normalizacao backend/frontend protege faixa de slot e janela invalida | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend && npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx app/agenda/NovoAgendamentoModal.tsx app/configuracoes/page.tsx lib/agenda-route-rules.ts
cd backend && source venv/bin/activate && python -m pytest -q tests/test_agenda_rendering_policy_config.py tests/test_configuracoes_autorizacao.py
cd backend && source venv/bin/activate && python -m pytest -q tests/test_agenda_sugestao_janela_operacional.py
```

Resultados:

- ESLint: ok (0 erros).
- Pytest `test_agenda_rendering_policy_config.py` + `test_configuracoes_autorizacao.py`: 5 passed.
- Pytest `test_agenda_sugestao_janela_operacional.py`: 23 passed.

## 3) Smoke manual recomendado

- Ajustar `slot_interval_min` para 20 min em Configuracoes e salvar.
- Validar Agenda panoramica com linhas de 20 min.
- Validar FullCalendar com grade de 20 min.
- Ativar `use_custom_window` e definir `08:00-20:00`, recarregar Agenda e validar faixa.
- Abrir modal de novo agendamento e clicar em `Gerar melhor oferta`, confirmando que o fluxo responde sem regressao.

## 4) Riscos residuais

- Se o intervalo configurado nao alinhar com horarios historicos antigos, a visualizacao em grade pode aparentar deslocamento de bloco em slots vizinhos.
