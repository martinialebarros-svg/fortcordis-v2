# Verify - agenda-domiciliar-tutor-georreferenciado

Data: 2026-07-08  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_tutor_panorama_georef.py::test_panorama_tutor_retorna_pets_e_status_georreferenciamento`, `::test_geocode_endereco_tutor_retorna_payload_google`, `::test_listar_tutores_expoe_campos_endereco_para_fluxo_domiciliar` e `::test_listar_tutores_nao_marca_coordenadas_zero_como_georreferenciadas` | ok |
| CA-002 | aceitacao | `backend/tests/test_agenda_origem_domiciliar.py::test_criar_agendamento_domiciliar_exige_tutor_georreferenciado`, `::test_criar_agendamento_domiciliar_rejeita_tutor_com_coordenadas_zero_sem_endereco` e `::test_criar_agendamento_domiciliar_persiste_origem_e_rotulo_operacional` | ok |
| CA-003 | aceitacao | `backend/tests/test_agenda_origem_domiciliar.py::test_agendamento_legado_resolve_tutor_id_pelo_paciente_na_lista_e_no_detalhe` e `backend/tests/test_agendamentos_origem_domiciliar_migration.py::test_upgrade_adds_columns_and_backfills_tutor_id_from_paciente` | ok |
| CA-004 | aceitacao | `backend/tests/test_agenda_origem_domiciliar.py::test_realizado_domiciliar_gera_os_com_preco_do_servico`, `backend/tests/test_ordens_servico_domiciliar.py::test_listar_ordens_rotula_domiciliar_corretamente`, `::test_atualizar_ordem_recalcula_preco_domiciliar_sem_clinica` e `::test_relatorio_pendencias_domiciliar_filtra_e_agrupa_por_tutor` | ok |
| CA-005 | frontend | `frontend/app/agenda/NovoAgendamentoModal.tsx` com autofill de CEP via ViaCEP, limpeza de georreferencia antiga e validacao por ESLint/`tsc --noEmit` | ok |
| CA-006 | aceitacao | `backend/tests/test_agenda_sugestao_janela_operacional.py::test_sugestoes_horario_domiciliar_usam_tutor_como_destino_operacional`, `::test_validacao_agendamento_domiciliar_exige_margem_segura_operacional` e `::test_sugestao_proximidade_domiciliar_reaproveita_ancora_operacional` | ok |
| NFR-001 | nao funcional | `backend/tests/test_agenda_busca_periodo_filtros.py` e `backend/tests/test_agenda_n_plus_one.py` mantiveram a listagem da agenda funcional com o novo `tutor_id_relacionado` | ok |
| NFR-002 | nao funcional | `backend/tests/test_migration_ci_cycle.py` validou o runner com o conjunto atual de migrations | ok |
| NFR-003 | nao funcional | `frontend/app/agenda/NovoAgendamentoModal.tsx` explicita fluxo domiciliar sem clinica ficticia e bloqueia save sem georreferenciamento do tutor | ok |
| NFR-004 | nao funcional | `backend/tests/test_agenda_sugestao_janela_operacional.py`, `backend/tests/test_agenda_assistente_orquestrador_metricas.py` e `frontend/app/agenda/NovoAgendamentoModal.tsx` mantiveram o mesmo assistente guiado para clinica e domiciliar usando destino operacional georreferenciado | ok |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/bin/python -m pytest \
  backend/tests/test_agenda_sugestao_janela_operacional.py \
  backend/tests/test_agenda_assistente_orquestrador_metricas.py \
  backend/tests/test_tutor_panorama_georef.py \
  backend/tests/test_agenda_origem_domiciliar.py

cd frontend
npx eslint \
  app/agenda/NovoAgendamentoModal.tsx

cd frontend
npx tsc --noEmit

git diff --check
```

Resumo dos resultados:
- Backend: 49 testes focados passaram, incluindo sugestao de horario, proximidade, orquestrador, tutor georreferenciado e fluxo domiciliar.
- Frontend: ESLint focado e `tsc --noEmit` passaram com o novo fluxo de CEP automatico no modal do tutor.
- Integridade textual: `git diff --check` passou sem whitespace ou marcacao quebrada.

## 3) Testes manuais

- Cenario 1: selecionar tutor sem georreferenciamento no modal de agenda domiciliar. Resultado esperado: bloqueio antes do save com orientacao para georreferenciar.
- Cenario 1.a: digitar ou colar um CEP valido no tutor e confirmar que endereco, bairro, cidade e UF sao preenchidos automaticamente antes do clique em `Georreferenciar endereco`.
- Cenario 2: georreferenciar o tutor, salvar agendamento domiciliar e confirmar que o card aparece como `Atendimento domiciliar`, sem clinica vinculada.
- Cenario 2.a: cadastrar tutor sem endereco, tentar salvar/agendar e confirmar que nenhum `0,0` e inferido no frontend.
- Cenario 2.b: alterar o CEP depois de um georreferenciamento existente e confirmar que latitude/longitude anteriores sao limpas.
- Cenario 2.c: com tutor georreferenciado, gerar melhor oferta no fluxo domiciliar e confirmar que o assistente sugere data/hora considerando deslocamento e agenda vizinha.
- Cenario 3: abrir o mesmo item na agenda lista e no FullCalendar e confirmar que o Waze/Google Maps usa o endereco do tutor.
- Cenario 4: concluir o agendamento domiciliar como `Realizado` e validar na tela financeira que a OS ficou sem clinica e com preco domiciliar do servico.
- Cenario 4.a: tentar salvar um domiciliar em horario que viole a margem entre um atendimento de clinica e outro destino e confirmar bloqueio por conflito operacional.
- Cenario 5: em ambiente com legado, abrir um agendamento antigo com `paciente_id` preenchido e `tutor_id` nulo e confirmar que o tutor continua aparecendo apos a migration.

## 4) Regressao e riscos residuais

- Risco residual 1: o fluxo domiciliar ainda nao implementa roteirizacao multi-parada otimizada; a decisao continua local por slot/ancoras vizinhas.
- Risco residual 2: registros historicos sem `paciente_id` continuam sem caminho de recuperacao automatica de `tutor_id`.
- Risco residual 3: a validacao final mais fiel depende de smoke em producao, onde existem casos reais de legado e operacao domiciliar mista.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para producao.
