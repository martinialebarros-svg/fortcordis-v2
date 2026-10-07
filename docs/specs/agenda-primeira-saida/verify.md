# Verify — Primeira saída da Agenda

Data: 2026-10-07
Responsável: Codex
Status: implementado e validado localmente

## Matriz de rastreabilidade

| Critério | Evidência observada | Estado |
| --- | --- | --- |
| CA-001 | `test_agenda_primeira_saida.py::test_hoje_0824_nao_oferece_primeiro_atendimento_sem_tempo_de_chegada` | ok |
| CA-002 | `test_primeiro_atendimento_futuro_usa_abertura_mais_viagem_em_cidade_sem_piso` (Fortaleza e Aquiraz) | ok |
| CA-003 | `test_pisos_de_caucaia_maracanau_eusebio_itaitinga`, `test_piso_municipal_tambem_e_validado_no_salvamento` e `test_piso_do_ce_nao_se_aplica_a_municipio_de_outra_uf` | ok |
| CA-004 | `test_viagem_longa_prevalece_sobre_piso_municipal` e `test_piso_configurado_para_outro_municipio_limita_sugestao` | ok |
| CA-005 | `test_rota_indisponivel_falha_fechada_na_sugestao_e_escrita` rejeita zero e heurísticas de linha reta/cidade/região; `test_base_residencial_sem_default_exige_configuracao_persistida` exige base configurada; testes de geocodificação, falta de Google e destino sem localização | ok |
| CA-006 | `test_segundos_nao_arredondam_chegada_para_baixo` e borda exata de salvamento em `test_piso_municipal_tambem_e_validado_no_salvamento` | ok |
| CA-007 | `test_revalidacao_do_aceite_usa_slot_exato_e_relogio_atual`, `test_oferta_que_envelhece_e_rejeitada_no_salvamento` e teste do modal de preferências (erro 409 visível por `role=alert`) | ok |
| CA-008 | `test_agendamento_intermediario_usa_vizinho_anterior_e_nao_casa` e `test_edicao_de_primeiro_domicilio_revalida_novo_tutor_sem_mudar_horario` | ok |
| CA-009 | Regressão de janela/encaixes/reserva, suíte backend completa e suíte frontend completa | ok |

## Testes executados

- Backend: `python -m pytest tests -q --disable-warnings` no venv Python 3.11,
  com `DATABASE_URL=sqlite:///./fortcordis.db`, `FORTCORDIS_PROCESS_ROLE=api`
  e `PYTHONPATH` apontando para esta worktree. Resultado: **1.609 aprovados,
  9 ignorados, 458 subtests aprovados**, exit 0 em 69,11 s. Banco temporário,
  rota Google e geocodificação sintéticas nos testes da feature; sem uso de
  paciente real ou criação de agenda operacional.
- Foco backend: `test_agenda_primeira_saida.py` e
  `test_agenda_sugestao_janela_operacional.py` juntos: **51 aprovados e 18
  subtests aprovados** antes da inclusão do teste de edição domiciliar. Este
  teste adicional passou isoladamente e está incluído na suíte backend completa.
- Frontend: `vitest run`, **535 testes em 77 arquivos**, exit 0. Os quatro
  arquivos focados do modal/configuração passaram com **17 testes**. ESLint
  direcionado com `--max-warnings=0`, `tsc --noEmit` e `npm run build` passaram;
  o build gerou 43 páginas estáticas.
- `git diff --check` e inspeção dos quatro artefatos SDD foram concluídos neste
  ciclo. O guardrail automatizado baseado em SHA será executado no PR; nenhum
  arquivo foi staged, commitado ou publicado para simular esse gate.

## Comportamento e limites operacionais

- A base residencial existente aceita endereço/CEP; sem coordenadas, depende de
  geocodificação e rota Google habilitadas. Sem rota confiável, o sistema deixa
  a primeira oferta vazia e bloqueia o salvamento com
  `PRIMEIRA_SAIDA_INVIAVEL`. Isso é falha segura, mas exige correção operacional
  da configuração/serviço para voltar a oferecer o primeiro horário.
- Endereço e CEP residenciais foram removidos dos defaults de backend e
  frontend. A origem é lida da configuração persistida com acesso autenticado;
  ambientes sem essa configuração permanecem bloqueados para primeira saída.
  Testes de normalização exigem defaults vazios e usam origem sintética.
- A duração Google pode não refletir tráfego em tempo real porque
  `LOGISTICA_GOOGLE_TRAFFIC_AWARE` tem default `False`. A margem segura é
  preservada; nenhum horário calculado garante chegada em trânsito variável.
- `/agenda/assistente/validar-oferta` reconsulta ocupação, bloqueio e rota sem
  mutar reservas expiradas. A escrita continua sendo a validação final contra
  corrida, reserva vencida e mudança de horário.
- Não houve publicação em stage/produção, teste autenticado com dados reais ou
  agendamento real nesta etapa. A validação de disponibilidade em ambiente
  publicado requer o fluxo protegido de release.

## Decisão desta etapa

Implementação local pronta para revisão. Publicação e comprovação de runtime
seguem separadas e dependem de autorização posterior.
