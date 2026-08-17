# Verify - laudos-fila-pendentes-agenda

Data: 2026-08-16 (correcao 2026-08-17)
Responsavel: Claude (pareado com Martiniano)
Status: implementado - corrigido e reverificado apos teste real em stage

## 0) Historico

A primeira versao (2026-08-16) foi verificada so com dados semeados
diretamente no banco simulando o fluxo de Atendimento Clinico completo -
nunca exercitou o fluxo real mais comum (agendamento marcado Realizado
direto na Agenda, sem Atendimento Clinico). Testado ao vivo em stage
pelo usuario: "conferi aqui e esta vazia mesmo eu mudando um status na
agenda para realizado". Investigacao (`intent.md` secao 8) revelou que
a fila e o indicador de agilidade so cobriam o fluxo raro. Reescritos
(fase 6 do `plan.md`) e reverificados abaixo - a fila anterior a essa
correcao nunca foi promovida pra producao.

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-1 | `test_exame_realizado_sem_laudo_aparece_na_fila` (Fonte A) | ok |
| CA-2 | `test_exame_com_laudo_rascunho_aparece_na_fila` (Fonte A) | ok |
| CA-3 | `test_exame_de_agendamento_nao_realizado_nao_aparece` + `test_agendamento_nao_realizado_com_servico_exame_nao_aparece` (Fonte B) | ok |
| CA-4 | `test_exame_com_laudo_finalizado_nao_aparece` + `test_agendamento_com_laudo_finalizado_nao_aparece` (Fonte B) | ok |
| CA-5 | `test_exame_sem_atendimento_nao_aparece` (eletrocardiograma upload sem agenda nunca tem `atendimento_id`/`agendamento_id`) | ok |
| CA-6 | `test_laudo_agilidade_service.py` (5 casos de borda) + `test_exame_atrasado_recebe_selo_atrasado` + `test_agendamento_atrasado_usa_horario_agendado_como_referencia` + confirmado ao vivo (selo "Atrasado (48.1h uteis)") | ok |
| CA-7 | `test_urgente_no_agendamento_aparece_primeiro_mesmo_sendo_mais_recente` + `test_toggle_urgente_via_atualizar_agendamento` + verificado ao vivo: `PUT /agenda/{id}` com `{urgente_laudo: true}` retornou 200, os 2 itens do combo "Eco + Eletro" subiram juntos pro topo com destaque "Urgente"; desmarcar reverteu (novo `PUT` 200, badge removido) | ok |
| CA-8 | Verificado ao vivo: item Fonte B sem laudo abriu `/laudos/novo?agendamento_id=15&tipo=ecocardiograma` com paciente/tutor pre-preenchidos; apos laudo criado, item mudou pra "Rascunho em aberto" com botao "Continuar laudo" -> abriu `/laudos/7/editar` (laudo correto) | ok |
| CA-9 | `test_laudo_finalizado_em_evento.py::test_atualizacao_rascunho_para_finalizado_preenche_uma_vez` | ok |
| CA-10 | `test_laudo_finalizado_em_evento.py::test_criacao_direta_com_status_finalizado_preenche` + confirmado ao vivo (evento populou `finalizado_em` ao marcar um laudo real como Finalizado via script) | ok |
| CA-11 | `test_agilidade_calcula_percentual_e_tendencia` + `test_agilidade_conta_laudo_sem_exame_vinculado` (fluxo comum, sem Exame) + confirmado ao vivo: card foi de "sem dados" para "0 de 1 laudo(s)"/"48.1h uteis" apos finalizar um laudo criado so via `agendamento_id` (sem nenhum Exame) | ok |
| CA-12 | `test_agendamento_servico_nao_exame_nao_aparece` (Consulta/Drenagem de Efusao Pericardica/Reavaliacao-Retorno) | ok |
| CA-13 | `test_agendamento_combo_gera_dois_itens_pendentes` + `test_agendamento_combo_com_um_tipo_finalizado_gera_um_item` + confirmado ao vivo (combo "Eco + Eletro" gerou 2 itens; finalizar 1 tipo deixou so o outro) | ok |
| CA-14 | `test_agendamento_servico_id_nulo_usa_nome_denormalizado` | ok |

## 2) Testes automatizados executados

- `backend/tests/test_laudo_finalizado_em_exame_urgente_migration.py` - 2 testes (migration `20260816_70`, ainda valida isoladamente), passou.
- `backend/tests/test_agendamento_urgente_laudo_migration.py` - 3 testes (migration `20260817_71`: adiciona `agendamentos.urgente_laudo`, remove `exames.urgente_laudo`, idempotencia), passou. **Novo.**
- `backend/tests/test_laudo_finalizado_em_evento.py` - 3 testes (evento SQLAlchemy `before_insert`/`before_update`), passou.
- `backend/tests/test_laudo_agilidade_service.py` - 5 testes (`horas_uteis_entre`, casos de borda), passou.
- `backend/tests/test_laudos_fila_pendentes.py` - **19 testes** (9 originais da Fonte A + 10 novos: Fonte B simples/combo/fallback de servico/exclusao de servico nao-exame, toggle via `atualizar_agendamento`, agilidade sem Exame vinculado), passou.
- Suite completa: `venv/bin/python -m pytest tests/ -q` -> **790 passed, 25 warnings, 41 subtests passed em ~38-40s** (sem regressao).
- Frontend: `tsc --noEmit` sem erros novos em `frontend/app/laudos/page.tsx`.

## 3) Testes manuais (ao vivo, apos a correcao)

Executado localmente (backend porta 8000, frontend porta 3002), migration
`20260817_71` aplicada ao banco de dev, login admin ja autenticado:

1. Seed via script Python: 2 agendamentos **sem Atendimento Clinico**
   vinculados a um paciente/tutor novos - um com servico "Ecocardiograma"
   (~1 dia atras, dentro do prazo) e um combo "Eco + Eletro" (~4 dias
   atras, `servico_id` propositalmente nulo pra testar o fallback pro
   nome denormalizado).
2. Aba "Pendentes" mostrou 4 itens: os 2 do combo (Ecocardiograma +
   Eletrocardiograma, ambos "Atrasado (48.1h uteis)"), o simples
   (nao atrasado), e um item pre-existente do banco de dev - contagem
   "Pendentes (4)" batendo com o total.
3. Marcar urgente no item Ecocardiograma do combo (`PUT /agenda/15` ->
   200) moveu **os 2 itens do mesmo agendamento** (Ecocardiograma e
   Eletrocardiograma) pro topo da lista com selo "Urgente" - confirma
   que o marcador e por agendamento, nao por exame individual.
4. "Criar laudo" no item Ecocardiograma abriu
   `/laudos/novo?agendamento_id=15&tipo=ecocardiograma` com "Paciente
   Verificacao Fluxo B"/"Tutor Verificacao Fluxo B" pre-preenchidos
   (cabecalho "Agendamento vinculado: #15") - confirma prefill via
   `agendamento_id` funcionando igual ao dropdown "Laudar" existente.
5. Laudo em rascunho inserido (simulando o salvamento manual, que exige
   confirmar um dialog nativo que o navegador headless nao consegue
   clicar) - reload da aba Pendentes mostrou o item com selo "Rascunho
   em aberto" e botao "Continuar laudo" -> abriu `/laudos/7/editar`
   (laudo correto); o item irmao do combo (Eletrocardiograma) continuou
   pendente sem laudo, provando independencia por tipo dentro do combo.
6. Laudo marcado como Finalizado via script - evento SQLAlchemy
   preencheu `finalizado_em` automaticamente (confirmado em contexto de
   banco real, nao so teste unitario). Reload: "Pendentes" caiu de 4
   para 3 (item finalizado saiu, irmao do combo continuou); card de
   Agilidade passou de "sem dados" para "No prazo (ultimos 90 dias): 0
   de 1 laudo(s)", "Tempo medio: 48.1h uteis", "prazo: 48h uteis",
   tendencia nula (sem dado nos 90 dias anteriores) - tudo calculado
   directo por `Laudo.agendamento_id`, sem nenhum `Exame` envolvido.
7. Desmarcar urgencia (`PUT /agenda/15` -> 200 de novo) confirmado.
8. Limpeza: laudo e agendamentos semeados removidos via script; paciente
   e tutor de teste removidos. Confirmado `cleanup done`.
9. Servidores locais (backend e frontend) parados ao final.

## 4) Regressao e riscos residuais

- Suite completa (790 testes) verde - nenhuma regressao detectada.
- O indicador de agilidade da versao anterior (Exame-only) tambem
  subcontava o fluxo comum - corrigido junto (RF-9 revisado), nao so a
  fila.
- Risco residual aceito (fora de escopo, `intent.md` secao 2 e 4):
  eletrocardiogramas enviados sem passar pela Agenda continuam sem
  estado "aguardando laudo".
- Risco residual aceito: o mapeamento `SERVICO_NOME_TIPOS_LAUDO` e uma
  lista fixa por nome de servico - um servico novo cadastrado em
  `/servicos` que deveria gerar laudo nao aparecera na fila ate o
  mapeamento ser atualizado manualmente no codigo. Aceito por ora dado
  o catalogo real ser pequeno e estavel (8 servicos); revisar se o
  catalogo crescer ou mudar com frequencia.
- Risco residual baixo: Fonte B carrega todos os agendamentos
  "Realizado" sem Atendimento Clinico sem paginacao no banco (pagina so
  em memoria) - aceitavel pro volume atual.

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
