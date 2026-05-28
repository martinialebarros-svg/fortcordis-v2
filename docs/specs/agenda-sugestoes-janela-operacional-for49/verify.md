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
| CA-004 | aceitacao | `sugerir_horarios_agenda` separa lista de conflito (agenda ativa) da lista operacional (vizinhos/score) para nao perder ocupacao real | ok |
| CA-005 | aceitacao | `test_sugestoes_horario_ignoram_slots_passados_no_dia_atual` garante corte de horarios retroativos no dia atual | ok |
| CA-006 | aceitacao | `test_sugestao_proximidade_distante_sem_ancora_d2_prioriza_dias_politica` + `test_sugestao_proximidade_sem_base_geo_aplica_regra_conservadora` impedem oferta D+2 fora da politica | ok |
| CA-007 | aceitacao | `test_ancora_d2_fallback_mesma_cidade_com_um_agendamento_valido` + `test_ancora_d2_fallback_cluster_mesma_cidade_quando_sem_matriz` habilitam D+2 por fallback local sem matriz | ok |
| CA-008 | aceitacao | `test_rank_prioriza_deslocamento_antes_data_preferencial` garante prioridade de menor deslocamento no ranking | ok |
| CA-009 | aceitacao | `test_ancora_d2_considera_status_em_atendimento` valida status operacional como ancora | ok |
| CA-010 | aceitacao | `test_ancora_d2_fallback_por_proximidade_geografica_com_cadastro_inconsistente` cobre fallback geografico com cadastro divergente | ok |
| CA-011 | aceitacao | `test_sugestao_proximidade_ignora_ancora_passada_no_dia_atual` impede oferta de ancora vencida no dia atual | ok |
| CA-012 | aceitacao | datas de cenario atualizadas para horizonte estavel e compativel com regra de corte de passado no CI | ok |
| CA-013 | aceitacao | `test_sugestao_proximidade_ignora_ancora_sem_slot_operacional` impede sugestao de ancora quando nao ha slot viavel no assistente guiado | ok |
| CA-014 | aceitacao | `test_sugestoes_horario_nao_ofertam_slot_ocupado_mesmo_com_drift_em_inicio` bloqueia oferta de slot ocupado em cenario legado com drift `data/hora` x `inicio/fim` | ok |
| CA-015 | aceitacao | `test_sugestoes_horario_nao_ignoram_ocupacao_quando_data_legada_esta_em_formato_invalido` bloqueia slot ocupado com `data` legado fora do padrao ISO | ok |
| CA-016 | aceitacao | `test_sugestoes_horario_validam_proximo_fora_da_janela_para_evitar_conflito_operacional` impede oferta quando o proximo atendimento real ficaria sem folga de deslocamento | ok |
| NFR-001 | nao funcional | endpoint permanece com contrato retrocompativel | ok |
| NFR-002 | nao funcional | cache de janela por data via `_obter_janela_funcionamento_cacheada` | ok |
| NFR-004 | nao funcional | `sugerir_agendamento_proximo` valida aderencia com `sugerir_horarios_agenda` antes de exibir sugestao de ancora | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && ./venv/bin/pytest -q tests/test_agenda_sugestao_janela_operacional.py
cd backend && ./venv/bin/pytest -q tests/test_agenda_assistente_orquestrador_metricas.py
```

Resumo dos resultados:
- `test_agenda_sugestao_janela_operacional.py`: 23 passed.
- `test_agenda_assistente_orquestrador_metricas.py`: 5 passed.
- Avisos de deprecacao de Pydantic/SQLAlchemy ja existentes no projeto.

## 3) Testes manuais sugeridos (stage)

- Cenario 1: configurar um dia como fechado (excecao inativa), criar/ter legado nesse dia e validar que assistente de proximidade nao sugere esse slot.
- Cenario 2: configurar janela reduzida (ex.: 08:00-12:00), manter legado as 15:00 e validar que assistente ignora essa ancora.
- Cenario 3: no modal de novo agendamento, validar mensagem de indisponibilidade quando data-base estiver fechada e ausencia de sugestao invalida.
- Cenario 4: para clinica distante/baixa frequencia sem ancora proxima em D+2, validar que o assistente orienta D+3/D+4 e nao ancora em D+2 fora da politica.
- Cenario 5: para clinica sem matriz de deslocamento, com pelo menos 1 agendamento em D+2 na mesma cidade/UF e janela ativa, validar que o assistente volta a ofertar D+2.
- Cenario 6: manter um agendamento ativo no horario alvo com coluna `data` legado invalida (ex.: `26/05/2026`) e confirmar que o assistente nao oferta esse slot como livre.
- Cenario 7: manter atendimento seguinte real fora da janela ativa (ex.: 14:00 com janela encerrada as 13:30) e confirmar que o assistente nao oferta slot anterior com folga insuficiente de deslocamento.

## 4) Regressao e riscos residuais

- Risco residual 1: secretarias ainda podem ignorar mensagem textual; mitigacao prevista no FOR-50 (wizard guiado).
- Risco residual 2: qualidade de sugestao continua dependente de dados de localizacao das clinicas.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
