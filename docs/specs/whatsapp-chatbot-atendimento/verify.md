# Verify - whatsapp-chatbot-atendimento

Data: 2026-08-20  
Responsavel: Martiniano + Claude  
Status: draft

> Fases 1-3 entregues em 2026-08-22 (schema/config, gatilho/fila/worker,
> portões/identidade/guardrails de entrada). Com o bot habilitado, toda
> mensagem real hoje termina em `suppressed` ou `handoff` — nenhuma geração
> nem envio ao cliente acontece ainda (isso é Fase 4/6). As demais fases
> seguem pendentes. Nenhum item é marcado como `ok` sem teste ou log
> correspondente.

## Matriz de rastreabilidade

| ID | Tipo | Evidência planejada | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | teste de fila: inbound de texto cria 1 job `pending` com `scheduled_for` futuro | ok — `test_whatsapp_bot_queue_service.test_enqueue_cria_job_pending_com_debounce` |
| CA-002 | aceitação | teste de fila: segundo POST com o mesmo `wa_message_id` não cria job | ok — `test_whatsapp_bot_queue_service.test_reentrega_do_mesmo_wa_message_id_nao_cria_segundo_job` |
| CA-003 | aceitação | teste de debounce: 3 mensagens -> 2 jobs `superseded` + 1 ativo, 1 resposta | ok (debounce/supersede) — `test_whatsapp_bot_queue_service.test_mensagem_nova_supersede_job_pending_anterior_da_mesma_conversa`; a parte "1 resposta" só existe a partir da Fase 4 (geração), aqui o job ativo termina em `suppressed` (P2.4) |
| CA-004 | aceitação | teste do endpoint: enfileiramento com exceção forçada mantém `200` e as contagens do push | ok — `test_whatsapp_bot_webhook_enqueue.test_falha_no_enfileiramento_mantem_contagens_do_push_e_bot_job_enqueued_false` (chamada direta da funcao do endpoint; nao ha teste HTTP via TestClient neste modulo, seguindo o padrao já usado no resto da suíte) |
| CA-005 | aceitação | teste dos portões com cada interruptor em `false`: 0 jobs processados, 0 envios | ok (interruptor combinado RF-008) — `test_whatsapp_bot_gates.test_is_whatsapp_bot_enabled_exige_env_e_banco` (env off, banco off, os dois) + `test_whatsapp_bot_process_job.test_bot_desabilitado_suprime_sem_chamar_node` (job vira `suppressed`, zero chamadas ao Node) |
| CA-006 | aceitação | teste do worker em `suggest`: decisão `draft`, cliente HTTP do Node nunca chamado | pendente (Fase 4 — sem gerador ainda não existe candidato para virar `draft`; `resolve_conversation_mode` já resolve `suggest` corretamente, ver `test_whatsapp_bot_gates`) |
| CA-007 | aceitação | teste de pausa: mensagem humana -> `pausado_ate` no futuro, próximo job `suppressed` | ok — `test_whatsapp_bot_process_job.test_resposta_humana_from_me_pausa` (detecta `from_me=true` no Node e pausa) e `test_pausa_local_ainda_vigente_suprime_sem_chamar_node` (pausa já vigente localmente) |
| CA-008 | aceitação | teste de janela: `last_inbound_at` com mais de 24h -> `suppressed` | ok — `test_whatsapp_bot_process_job.test_janela_de_24h_fechada_suprime` + `test_whatsapp_bot_gates.test_customer_service_window` (unitário, replica `describeCustomerServiceWindow`) |
| CA-009 | aceitação | teste por tipo: `audio`/`image`/`document` -> `handoff` sem geração | ok — `test_whatsapp_bot_process_job.test_tipo_nao_suportado_vira_handoff_sem_alerta` + `test_whatsapp_bot_gates.test_is_supported_message_type` (audio/image/document/sticker/reaction/interactive/button, todos `False`) |
| CA-010 | aceitação | teste de pedido de humano: `pending` no Node, alerta criado, provider de LLM não chamado | ok — `test_whatsapp_bot_process_job.test_pedido_de_humano_dispara_handoff_com_alerta_patch_e_push` (PATCH status=pending, alerta `nivel=aviso`, push chamados; nenhum provider de LLM existe ainda nesta fase para "não chamar") |
| CA-011 | aceitação | teste de emergência: resposta fixa, `criar_alerta_interno(nivel="critico")`, gerador não chamado | ok — `test_whatsapp_bot_process_job.test_emergencia_dispara_handoff_critico_com_alerta_patch_e_push` (texto fixo em `texto_gerado`, alerta `nivel=critico`, `handoff_motivo=emergencia`) + `test_emergencia_ignora_pausa_e_janela_fechada` (prioridade sobre os outros portões) |
| CA-012 | aceitação | teste do nono dígito em `test_whatsapp_conversation_context.py`: `matched` para as duas formas | ok — `test_resolve_tutor_and_pet` (forma local, já existia) + `test_resolve_tutor_pela_identidade_canonica_sem_nono_digito` (forma canonica do Node, novo) |
| CA-013 | aceitação | teste de escopo: contexto `ambiguous`/`not_found` -> resposta sem dado de registro | pendente (Fase 4 — depende de geração real; `resolve_whatsapp_context` já devolve `ambiguous`/`not_found` corretamente, testado desde antes desta spec) |
| CA-014 | aceitação | teste de allowlist: intent fora da lista em conversa `auto` -> `draft` | pendente |
| CA-015 | aceitação | teste do validador: candidata com conteúdo clínico -> `blocked` + motivo gravado | pendente |
| CA-016 | aceitação | teste de fonte: sem tool e sem trecho recuperado -> não envia | pendente |
| CA-017 | aceitação | teste de teto: acima do limite diário -> `suppressed` com motivo de teto | pendente |
| CA-018 | aceitação | teste de envio em `auto`: chamada ao Node com `metadata.origem = "bot"` | pendente |
| CA-019 | aceitação | teste do preview: nenhum job alterado, nenhuma geração, nenhum envio | ok — `test_whatsapp_bot_endpoints.test_preview_nao_altera_nada_e_conta_por_status_e_decisao` (endpoint é só leitura/agregação; contagens de jobs/respostas antes e depois idênticas) |
| CA-020 | aceitação | teste de autorização em `test_configuracoes_autorizacao.py` (403 para não admin) + smoke sem restart | ok — 5 testes novos em `test_configuracoes_autorizacao.py` (403 para `whatsapp_bot_atendimento_habilitado` e `whatsapp_bot_modo`, 422 para modo invalido, reenvio sem mudança permitido para não-admin, admin habilita e muda modo); "sem restart" decorre de `is_whatsapp_bot_enabled()`/`resolve_conversation_mode()` lerem o banco a cada chamada, sem cache — não medido em stage real |
| CA-021 | aceitação | teste do worker com advisory lock ocupado: ciclo pulado, 0 jobs tocados | ok — `test_whatsapp_bot_worker_service.test_run_due_once_pula_ciclo_com_lock_distribuido_ocupado` |
| CA-022 | aceitação | teste de redação de log: corpo completo e número completo ausentes da saída | ok (revisão estática, não automatizada) — nenhum `logger.*` em `whatsapp_bot_worker_service.py`/`whatsapp_bot_gates.py`/`whatsapp_bot_handoff_service.py` referencia `wa_identity` ou corpo de mensagem; só `job.id`/`conversation_id` (id opaco do Node, não é telefone) e contagens. Falta um teste automatizado que capture o log handler e afirme isso (registrado como pendencia) |
| CA-023 | aceitação | teste de escopo entre personas: conversa `clinica` sem dado de tutor de outra clínica, e vice-versa | pendente (Fase 4 — depende das tools com escopo) |
| CA-024 | aceitação | teste de allowlist: intent de OS/cobrança em `auto` -> `draft` nas duas personas | pendente (Fase 4) |
| CA-025 | aceitação | teste de handoff: fora da janela informa próximo horário; dentro, informa transferência; emergência mantém contato imediato | ok — `test_whatsapp_bot_handoff_service.py`: dentro do expediente (`test_build_handoff_message_dentro_do_expediente_informa_transferencia`), fora dele com o próximo horário (`..._fora_do_expediente_informa_proximo_horario`, `..._tarde_de_sabado_aponta_segunda`); emergência usa `EMERGENCY_FIXED_MESSAGE` sempre, independente de horário (`test_whatsapp_bot_process_job.test_emergencia_ignora_pausa_e_janela_fechada`) |
| CA-026 | aceitação | teste de corrida: claim durante o debounce -> job `suppressed`, sem envio e sem rascunho | ok — `test_whatsapp_bot_process_job.test_claim_detectado_no_node_pausa_e_grava_estado_local` (`last_agent_id` preenchido no Node -> `suppressed`/`pausado`, nenhum PATCH/alerta/push chamado) |
| NFR-001 | não funcional | inspeção de `config.py`/`.env.example`/migração: todos os defaults desligados | ok — `WHATSAPP_BOT_ENABLED=False` (`backend/app/core/config.py`), `whatsapp_bot_atendimento_habilitado`/`whatsapp_bot_modo` nascem `false`/`suggest` (migração `20260820_75`, testado em `test_whatsapp_bot_migration.test_upgrade_adiciona_colunas_em_configuracoes_com_default_seguro`) |
| NFR-002 | não funcional | medição do tempo do endpoint de mensagem recebida antes e depois do enfileiramento | ok (ordem de grandeza) — 30 chamadas locais em sqlite, com enfileiramento: média 2.77ms / p95 0.98ms; sem os campos novos (payload antigo): média ~0ms. Bem abaixo do orçamento de ~50ms; não é uma medição de stage/produção com Postgres real |
| NFR-003 | não funcional | `build_runtime_report()` expondo `whatsapp_bot_worker` | ok — `report["observability"]["whatsapp_bot_worker"]` com `enabled`, `status`, `thread_alive`, `worker_started`, `stop_signal_set`, `poll_seconds`, `pending_jobs`, `last_cycle_at`, verificado por inspeção direta (`build_runtime_report()`) e pela suíte completa (nenhuma regressão nos demais workers) |
| NFR-004 | não funcional | revisão dos logs emitidos em um ciclo completo em stage | parcial — revisão estática do código desta fase ok (ver CA-022); revisão de log real de stage segue pendente |
| NFR-005 | não funcional | contadores de custo por conversa em `whatsapp_bot_respostas` + degradação para `suggest` | pendente (Fase 4) |
| NFR-006 | não funcional | teste de migração idempotente (aplicar duas vezes, e no-op sem tabela) | ok — `backend/tests/test_whatsapp_bot_migration.py` (4 testes: tabelas+índices, unicidade de `wa_message_id`, colunas em `configuracoes` com default seguro, no-op sem `configuracoes`), rodado duas vezes em sequência em cada teste |
| NFR-007 | não funcional | inspeção: nenhuma query do backend principal em `conversations`/`messages` | ok — a reconciliação (`whatsapp_bot_worker_service.run_reconciliation_sweep`) só fala com o Node via `httpx` + `x-whatsapp-internal-token` (`GET /conversations`, `GET /conversations/:id/messages`); nenhum acesso direto ao Postgres do whatsapp-stage-backend em nenhum arquivo desta fase |

## Testes automatizados a executar

```bash
# backend
cd backend
venv/bin/python -m unittest tests.test_whatsapp_bot_migration -v
venv/bin/python -m unittest tests.test_whatsapp_bot_queue_service -v
venv/bin/python -m unittest tests.test_whatsapp_bot_worker_service -v
venv/bin/python -m unittest tests.test_whatsapp_bot_webhook_enqueue -v
venv/bin/python -m unittest tests.test_whatsapp_bot_gates -v
venv/bin/python -m unittest tests.test_whatsapp_bot_handoff_service -v
venv/bin/python -m unittest tests.test_whatsapp_bot_process_job -v
venv/bin/python -m unittest tests.test_whatsapp_bot_endpoints -v
venv/bin/python -m unittest tests.test_whatsapp_bot_generation -v
venv/bin/python -m unittest tests.test_whatsapp_conversation_context -v
venv/bin/python -m unittest tests.test_configuracoes_autorizacao -v
venv/bin/python -m unittest discover -s tests -p "test_*.py"

# serviço WhatsApp
cd ../whatsapp-stage-backend
npm run build
npm run test:inbox-ui

# frontend
cd ../frontend
npx eslint app/whatsapp-stage/page.tsx app/configuracoes/page.tsx --max-warnings=0
npx tsc --noEmit
npx next build
```

Resumo dos resultados (Fase 1, 2026-08-22):
- Backend: `test_whatsapp_bot_migration` (4/4 ok, isolado). `unittest discover -s tests -p "test_*.py"`
  completo: 850 testes, 0 falha, 0 erro — suíte cresceu de ~805 para 850 porque
  esta sessão também trouxe os testes de `agenda-formalizacao-portal-clinicas`
  que já estavam pendentes de sincronizar nesta branch; nenhum teste novo desta
  fase quebrou algo existente. Migração `20260820_75` aplicada com sucesso via
  `setup_database.py` num sqlite de dev novo (88 migrações no total).
  `tests.test_whatsapp_bot_queue_service/_worker_service/_gates/_generation`
  ainda não existem — são das Fases 2-4, fora do escopo desta entrega.
- Serviço WhatsApp: não tocado nesta fase (Fase 1 é só backend/schema).
- Frontend: não tocado nesta fase (Fase 1 é só backend/schema).

Resumo dos resultados (Fase 2, 2026-08-22):
- Backend: `test_whatsapp_bot_queue_service` (6/6), `test_whatsapp_bot_worker_service`
  (9/9, inclui lock ocupado, retry/limite de tentativas e reconciliação com
  `httpx.get` mockado) e `test_whatsapp_bot_webhook_enqueue` (3/3, CA-004).
  `unittest discover -s tests -p "test_*.py"` completo: 868/868, 0 falha —
  cresceu de 850 para 868 com os 18 testes novos desta fase, sem regressão.
  Smoke end-to-end manual num sqlite de dev real (não um teste automatizado):
  `notify_whatsapp_inbound_message` com payload completo -> `bot_job_enqueued=true`
  -> worker real (thread + poll, debounce=1s) -> job `done` com resposta
  `decisao=suppressed`, `motivo=fase_2_gerador_stub_sem_geracao_real` em ~2s.
  Medição de latência do endpoint (NFR-002, local/sqlite, não é stage): 30
  chamadas com os campos novos, média 2.77ms / p95 0.98ms.
  `tests.test_whatsapp_bot_gates/_generation` ainda não existem — são das
  Fases 3-4.
- Serviço WhatsApp: `npm run build` (tsc) limpo e `npm run test:phone-number`
  ok. Sem teste dedicado para `notifyPushForInboundMessage` — não havia
  precedente de teste unitário para essa função (é fire-and-forget, hoje só
  exercitada via webhook completo em stage); os testes que dependem de
  Postgres (`test:inbox-ui` e outros com `DATABASE_URL=postgres://...`) não
  rodaram nesta sessão por não terem essa role/banco disponíveis no ambiente
  local usado.
- Frontend: não tocado nesta fase (Fase 2 é gatilho/fila/worker no backend +
  transporte no Node; UI é Fase 5).

Resumo dos resultados (Fase 3, 2026-08-22):
- Backend: `test_whatsapp_bot_gates` (10/10), `test_whatsapp_bot_handoff_service`
  (8/8), `test_whatsapp_bot_process_job` (11/11 — cada ramo da árvore de
  decisão, incluindo emergência sobrepondo pausa/janela e claim detectado
  via `last_agent_id`), `test_whatsapp_bot_endpoints` (6/6, os 3 endpoints
  novos), `test_whatsapp_conversation_context` (6/6, +2 do nono dígito),
  `test_configuracoes_autorizacao` (9/9, +5 do toggle/modo do bot).
  `unittest discover -s tests -p "test_*.py"` completo: 909/909, 0 falha —
  cresceu de 868 para 909 com os 41 testes novos/alterados desta fase
  (35 novos + os que passaram a exercitar o motivo `bot_desabilitado` em
  vez do stub da Fase 2), sem regressão. Smoke manual live (não automatizado):
  worker real com o bot habilitado e `WHATSAPP_AGENDA_SERVICE_URL` vazio —
  o job vai para `error`/retry (`attempts=1`, `last_error` gravado) sem
  derrubar a thread do worker.
- Serviço WhatsApp: não tocado nesta fase (Fase 3 é toda backend Python:
  portões, vocabulário, handoff, endpoints).
- Frontend: não tocado nesta fase (a UI dos controles de conversa é Fase 5).

## Testes manuais planejados (stage)

1. `GET /api/v1/whatsapp/bot/preview` com o bot desligado — medir alcance real
   antes de habilitar, sem gerar nem enviar nada.
2. Conversa real em `suggest`: confirmar que o rascunho aparece na central e que
   nada é enviado sem clique.
3. "Quero falar com um atendente" — handoff imediato, conversa em `pending`,
   push recebido pela equipe.
4. Termo de emergência — resposta fixa, alerta interno `critico`, nenhuma
   geração.
5. Número não cadastrado — resposta sem nenhum dado de registro.
6. Mensagem de áudio — handoff, sem tentativa de resposta.
7. Janela de 24h fechada — nenhuma mensagem enviada.
8. Desmarcar o toggle em Configurações durante tráfego — o bot para no ciclo
   seguinte, sem restart.
9. Conversa de clínica parceira e conversa de tutor lado a lado — confirmar que
   a persona, o tom e o escopo de dado mudam, e que nenhuma alcança dado da
   outra.
10. Mensagem fora do expediente (bot roda 24/7) — o handoff informa o próximo
    horário de atendimento, não "vou transferir agora".
11. Atendente dá claim enquanto o debounce corre — o bot não responde por cima.

## Números a coletar na Fase 6.3 (stage)

Sem estes, a decisão de ligar o modo `auto` é chute:

| Métrica | Quebra |
| --- | --- |
| Taxa de aceite dos rascunhos | por persona (tutor / clínica) |
| Taxa de bloqueio do validador de saída | por motivo |
| Contenção (resposta sem handoff) | por persona e por dentro/fora do expediente |
| Latência da primeira resposta | por dentro/fora do expediente |
| Custo por conversa | total e p95 |

## Regressão e riscos residuais

- A correção do nono dígito (RF-015) altera um endpoint já consumido pela
  central de atendimento; exige teste de não regressão para os formatos que
  funcionam hoje.
- O endpoint de mensagem recebida passa a fazer mais trabalho no caminho do
  webhook; o timeout de 5s do Node é a margem, e NFR-002 é o limite aceito.
- Qualidade de resposta só é mensurável com tráfego real: o dado da Fase 6.3 é
  o que autoriza o modo `auto`, e antes disso qualquer estimativa é chute.
- A colisão de `DISTRIBUTED_LOCK_KEY` entre o worker de lembrete e o do
  assistente IA continua existindo (fora de escopo aqui) — o worker do bot usa
  chave própria e não piora o quadro.
- Com o bot 24/7, a janela operacional da agenda é usada como proxy do horário
  em que alguém realmente lê o inbox (CB-010). Se as duas divergirem na
  prática, o texto de handoff fora do expediente vai prometer um horário
  errado — sinal para criar configuração própria de horário de atendimento.
- Atender as duas personas no mesmo canal concentra o risco de vazamento no
  `match_type` e nos filtros das tools; CA-023 cobre o caminho feliz, mas
  número mal cadastrado ou compartilhado entre clínica e tutor continua caindo
  em `ambiguous`, que por RF-016 não revela nada — seguro, porém inútil para o
  cliente até alguém corrigir o cadastro.

## Itens fora de escopo entregues

- Nenhum até o momento.

## Decisão de release

- [ ] Aprovado para stage.
- [ ] Aprovado para produção em modo `suggest`.
- [ ] Aprovado para produção em modo `auto` (allowlist da RF-019).
- [ ] Não aprovado (descrever motivo).
