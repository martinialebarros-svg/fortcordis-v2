# Verify - agenda-domiciliar-tutor-georreferenciado

Data: 2026-07-08  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `backend/tests/test_tutor_panorama_georef.py::test_panorama_tutor_retorna_pets_e_status_georreferenciamento`, `::test_geocode_endereco_tutor_retorna_payload_google` e `::test_listar_tutores_expoe_campos_endereco_para_fluxo_domiciliar` | ok |
| CA-002 | aceitacao | `backend/tests/test_agenda_origem_domiciliar.py::test_criar_agendamento_domiciliar_exige_tutor_georreferenciado` e `::test_criar_agendamento_domiciliar_persiste_origem_e_rotulo_operacional` | ok |
| CA-003 | aceitacao | `backend/tests/test_agenda_origem_domiciliar.py::test_agendamento_legado_resolve_tutor_id_pelo_paciente_na_lista_e_no_detalhe` e `backend/tests/test_agendamentos_origem_domiciliar_migration.py::test_upgrade_adds_columns_and_backfills_tutor_id_from_paciente` | ok |
| CA-004 | aceitacao | `backend/tests/test_agenda_origem_domiciliar.py::test_realizado_domiciliar_gera_os_com_preco_do_servico`, `backend/tests/test_ordens_servico_domiciliar.py::test_listar_ordens_rotula_domiciliar_corretamente`, `::test_atualizar_ordem_recalcula_preco_domiciliar_sem_clinica` e `::test_relatorio_pendencias_domiciliar_filtra_e_agrupa_por_tutor` | ok |
| CA-005 | frontend | Revisao de `frontend/lib/waze.ts`, `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` com lint e `tsc` focados | ok |
| NFR-001 | nao funcional | `backend/tests/test_agenda_busca_periodo_filtros.py` e `backend/tests/test_agenda_n_plus_one.py` mantiveram a listagem da agenda funcional com o novo `tutor_id_relacionado` | ok |
| NFR-002 | nao funcional | `backend/tests/test_migration_ci_cycle.py` validou o runner com o conjunto atual de migrations | ok |
| NFR-003 | nao funcional | `frontend/app/agenda/NovoAgendamentoModal.tsx` explicita fluxo domiciliar sem clinica ficticia e bloqueia save sem georreferenciamento do tutor | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
./venv/bin/python -m unittest \
  tests.test_tutor_panorama_georef \
  tests.test_agenda_origem_domiciliar \
  tests.test_ordens_servico_domiciliar \
  tests.test_agendamentos_origem_domiciliar_migration \
  tests.test_agenda_busca_periodo_filtros \
  tests.test_agenda_n_plus_one \
  tests.test_migration_ci_cycle

cd frontend
./node_modules/.bin/eslint \
  app/agenda/NovoAgendamentoModal.tsx \
  app/agenda/page.tsx \
  app/agenda/fullcalendar/page.tsx \
  app/financeiro/page.tsx \
  lib/waze.ts \
  lib/agenda-shared-actions.ts \
  --ext .ts,.tsx \
  --max-warnings=0

cd frontend
./node_modules/.bin/tsc --noEmit

cd /Users/martiniano/fortcordis-v2
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD
git diff --check
```

Resumo dos resultados:
- Backend: baterias focadas de tutor/agendamento/OS domiciliar, migration de backfill, regressao da agenda e ciclo de migrations passaram.
- Frontend: ESLint focado e `tsc --noEmit` passaram para os arquivos alterados deste pacote.
- Guardrail SDD: `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD` passou, mas como as mudancas ainda estavam apenas no working tree o script reportou `Sem mudancas de codigo ... guardrail SDD dispensado`; a validacao definitiva do guardrail deve ser repetida apos commit antes do push.

## 3) Testes manuais

- Cenario 1: selecionar tutor sem georreferenciamento no modal de agenda domiciliar. Resultado esperado: bloqueio antes do save com orientacao para georreferenciar.
- Cenario 2: georreferenciar o tutor, salvar agendamento domiciliar e confirmar que o card aparece como `Atendimento domiciliar`, sem clinica vinculada.
- Cenario 3: abrir o mesmo item na agenda lista e no FullCalendar e confirmar que o Waze/Google Maps usa o endereco do tutor.
- Cenario 4: concluir o agendamento domiciliar como `Realizado` e validar na tela financeira que a OS ficou sem clinica e com preco domiciliar do servico.
- Cenario 5: em ambiente com legado, abrir um agendamento antigo com `paciente_id` preenchido e `tutor_id` nulo e confirmar que o tutor continua aparecendo apos a migration.

## 4) Regressao e riscos residuais

- Risco residual 1: o fluxo domiciliar ainda nao usa assistente automatico de sugestao baseado no endereco do tutor; a escolha de data/hora permanece manual nesta fase.
- Risco residual 2: registros historicos sem `paciente_id` continuam sem caminho de recuperacao automatica de `tutor_id`.
- Risco residual 3: a validacao final mais fiel depende de smoke em producao, onde existem casos reais de legado e operacao domiciliar.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para producao.
