# Verify - agenda-sugestoes-janela-operacional-for49

Data: 2026-05-18  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_ancora_d2_nao_considera_dia_fechado` em `backend/tests/test_agenda_sugestao_janela_operacional.py` | ok |
| CA-002 | aceitacao | `test_sugestao_proximidade_ignora_agendamento_fora_janela` | ok |
| CA-003 | aceitacao | campo `itens_ignorados_janela` no retorno de `sugerir_agendamento_proximo` | ok |
| CA-004 | aceitacao | filtro `_filtrar_agendamentos_por_janela_funcionamento` aplicado em `sugerir_horarios_agenda` | ok |
| CA-005 | aceitacao | `test_sugestoes_horario_ignoram_slots_passados_no_dia_atual` garante corte de horarios retroativos no dia atual | ok |
| NFR-001 | nao funcional | endpoint permanece com contrato retrocompativel | ok |
| NFR-002 | nao funcional | cache de janela por data via `_obter_janela_funcionamento_cacheada` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && ./venv/bin/pytest -q tests/test_agenda_sugestao_janela_operacional.py
cd backend && ./venv/bin/pytest -q tests/test_agenda_deslocamento_cache.py tests/test_agenda_busca_periodo_filtros.py
```

Resumo dos resultados:
- `test_agenda_sugestao_janela_operacional.py`: 3 passed.
- `test_agenda_deslocamento_cache.py` + `test_agenda_busca_periodo_filtros.py`: 6 passed.
- Avisos de deprecacao de Pydantic/SQLAlchemy ja existentes no projeto.

## 3) Testes manuais sugeridos (stage)

- Cenario 1: configurar um dia como fechado (excecao inativa), criar/ter legado nesse dia e validar que assistente de proximidade nao sugere esse slot.
- Cenario 2: configurar janela reduzida (ex.: 08:00-12:00), manter legado as 15:00 e validar que assistente ignora essa ancora.
- Cenario 3: no modal de novo agendamento, validar mensagem de indisponibilidade quando data-base estiver fechada e ausencia de sugestao invalida.

## 4) Regressao e riscos residuais

- Risco residual 1: secretarias ainda podem ignorar mensagem textual; mitigacao prevista no FOR-50 (wizard guiado).
- Risco residual 2: qualidade de sugestao continua dependente de dados de localizacao das clinicas.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
