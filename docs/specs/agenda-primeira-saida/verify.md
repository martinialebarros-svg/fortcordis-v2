# Verify — Primeira saída da Agenda

Data: 2026-10-07
Responsável: Codex
Status: regra original validada em stage e produção; correções de 2026-10-10 com validação local concluída e publicação rastreada no PR #334

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
| CA-010 / RF-008 | `frontend/lib/agenda-route-rules.test.ts` preserva pisos adicionais ao alterar outra configuração e 54 entradas da API; `test_agenda_route_rules_normalization.py` cobre limite, aliases, defaults tardios e normalização repetida | ok local em 10/10 |
| CA-011 / RF-009 | `test_patch_reativa_primeiro_atendimento_ja_iniciado_sem_nova_saida_da_base`, `test_patch_reativa_cancelado_no_instante_original_do_inicio` e `test_patch_reativacao_expirada_ja_iniciada_ainda_exige_confirmacao` | ok local em 10/10 |
| CA-012 / RF-009 | Regressões HTTP `test_patch_reativacao_futura_*` e `test_patch_reativacao_ja_iniciada_preserva_*` verificam rejeição e status persistido intacto | ok local em 10/10 |

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
- O deploy em stage e o teste funcional autenticado estão registrados abaixo.
  Naquela etapa, não houve publicação em produção nem criação de agendamento
  para o smoke; a comprovação posterior de produção está na seção seguinte.

## Validação em stage — 2026-10-08

- Os PRs [#324](https://github.com/martinialebarros-svg/fortcordis-v2/pull/324),
  [#325](https://github.com/martinialebarros-svg/fortcordis-v2/pull/325) e
  [#326](https://github.com/martinialebarros-svg/fortcordis-v2/pull/326)
  chegaram ao commit `22941f3a` de stage. O último PR corrigiu fixtures
  sintéticas afetadas pela remoção do endereço padrão, sem afrouxar a regra
  operacional. O [deploy 37874486908](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37874486908)
  terminou com quality gate, guardrail SDD e implantação aprovados; logs
  confirmaram migrações, preservação/restauração dos seis arquivos de runtime,
  canário autenticado e exercício de restauração.
- Os três domínios de stage serviram `/agenda` com HTTP 200, todos os 18 chunks
  referenciados no HTML carregaram, e a API anônima `/api/v1/agenda` retornou
  401. O bundle servido contém o controle `A partir de`.
- Um smoke autenticado no loopback do backend de stage selecionou 16/10/2026
  após confirmar, em transação somente de leitura, que a data tinha zero
  registros de agendamento. Para uma clínica georreferenciada em Caucaia, a
  regra calculou início mínimo às **08:33** e a primeira oferta foi **08:45**;
  as 20 ofertas respeitaram o piso municipal e a rota Google. A revalidação
  de uma oferta anterior ao mínimo retornou `PRIMEIRA_SAIDA_INVIAVEL`.
  Para Animal Care, a preferência `A partir de 09:00` devolveu oito ofertas,
  nenhuma anterior às 09:00. O teste usou token interno efêmero, não exibiu
  endereço, credencial ou dados de pacientes e não salvou reserva/agendamento.

## Validação em produção — 2026-10-09

- O [PR #328](https://github.com/martinialebarros-svg/fortcordis-v2/pull/328)
  promoveu diretamente `stage` para `main` no commit `4a8b4876`. O
  [deploy 37876622484](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37876622484)
  terminou com quality gate, migrações, runtime gate, canário autenticado,
  preservação/restauração dos seis arquivos de runtime e exercício de
  restauração aprovados.
- Os cinco domínios de produção serviram `/agenda` com HTTP 200, os 18 chunks
  referenciados pelo HTML responderam 200, o controle `A partir de` estava no
  bundle servido e a API de agenda anônima retornou 401 em todos os hosts.
- Um smoke autenticado e sem gravação de agenda confirmou o SHA instalado e a
  identidade do banco de produção. Em **22/10/2026**, dia útil aberto sem
  qualquer linha de agendamento antes e depois do teste, uma clínica
  georreferenciada em Caucaia teve início mínimo às **08:32** e primeira oferta
  às **08:45**. As 30 opções respeitaram a rota Google e o piso municipal;
  revalidar o horário anterior ao mínimo retornou
  `PRIMEIRA_SAIDA_INVIAVEL`. O teste não exibiu dados de pacientes, endereço,
  CEP ou credenciais e não criou reserva/agendamento.

## Decisão desta etapa

A regra está publicada e comprovada em stage e produção no release
`4a8b4876`. A duração estimada da rota ainda varia com a disponibilidade da
API Google e com o trânsito, conforme o limite operacional descrito acima.

## Correções de configuração e reativação — 2026-10-10

Base desta alteração: `origin/stage` em `f5ed6699`, em worktree isolado.
Os registros de publicação acima se referem à regra original; estas correções
foram validadas localmente conforme abaixo. As evidências posteriores de deploy,
smoke e preservação de runtime ficam no
[PR #334](https://github.com/martinialebarros-svg/fortcordis-v2/pull/334) e no PR
direto de promoção vinculado a ele. O resultado local não é prova de publicação.

- A normalização frontend preserva o mapa completo dos pisos municipais,
  incluindo nomes com acentos e horários com os fallbacks do backend. O backend
  limita a 50 municípios adicionais distintos além dos quatro defaults, sem
  remover entradas aceitas em um novo ciclo de leitura/gravação.
- O PATCH de status dispensa somente a primeira saída residencial quando o
  início original já chegou/passou no horário local. A correção mantém o início
  original e as regras existentes de duração do serviço; disponibilidade,
  funcionamento, vizinhos e confirmação tardia continuam validados. O
  comportamento acompanha a edição via PUT.
- Prova antes/depois: as novas regressões falharam na versão anterior por perda
  de municípios e por `PRIMEIRA_SAIDA_INVIAVEL` na reativação histórica de hoje;
  passaram após as correções. Os testes HTTP usam FastAPI/TestClient, SQLite
  temporário, relógio fixo e estimadores sintéticos, com consulta posterior ao
  banco para verificar status e intervalo ou ausência de alteração em erros.
- Foco da reativação: `test_agenda_primeira_saida.py`,
  `test_agenda_reabilitar_reserva_expirada.py` e
  `test_agenda_excecao_deslocamento_persistente.py`: **47 aprovados e 24
  subtests aprovados**. Normalização e rendering policy: **7 aprovados e 4
  subtests aprovados**.
- Frontend: **9 testes de pisos municipais**; suíte completa com **560 testes
  Vitest em 77 arquivos e 9 testes Node**. ESLint completo e TypeScript completo
  (`tsc --noEmit --incremental false`) aprovados.
- Backend completo: `python -m pytest tests -q --disable-warnings` (Python
  3.11.15, `FORTCORDIS_PROCESS_ROLE=api`, `PYTHONPATH` deste worktree,
  `DATABASE_URL` SQLite de teste em `/private/tmp` e segredo sintético):
  **1.653 aprovados, 19 ignorados, 491 subtests aprovados**, exit 0 em 73,62 s.
- `npm run build` aprovado, com 43 páginas estáticas. `git diff --check`
  aprovado. Guardrail SDD aprovado pela função `evaluate_guardrail` aplicada
  aos arquivos alterados e novos do worktree, sem staging ou commit; features
  qualificadas: `agenda-primeira-saida` e
  `agenda-rota-regras-configuraveis-for48`.
- Revisão independente do frontend e do PATCH sem bloqueadores. A alteração
  de lógica fica em três arquivos, sem mudança de contrato público de API ou
  de esquema do banco. A suíte PostgreSQL opcional não foi exercitada nesta
  etapa; as regressões HTTP desta correção passaram em SQLite temporário.
- Na validação local não houve migração, publicação, envio externo, mudança
  de agendamentos reais ou gravação de configurações em stage/produção. A correção previne novas
  perdas; não tenta reconstruir pisos municipais eventualmente removidos antes.
