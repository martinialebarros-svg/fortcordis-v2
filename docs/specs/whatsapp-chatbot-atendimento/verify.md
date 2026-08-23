# Verify - whatsapp-chatbot-atendimento

Data: 2026-08-20
Responsavel: Martiniano + Claude
Status: draft

> Fases 1-3 entregues em 2026-08-22 (schema/config, gatilho/fila/worker,
> portões/identidade/guardrails de entrada). Fase 4 (geração e guardrails de
> saída) entregue em código e fechada no backend de stage em 2026-08-23: o job
> real `21` gerou e persistiu um rascunho em `suggest` com tool de preço, sem
> qualquer mensagem de saída. A Fase 5 foi implementada, publicada e validada
> em stage:
> revisão, edição, descarte, envio idempotente, selo e controles de operação.
> A tela autenticada exibiu o rascunho real e permitiu entrar/sair da edição
> sem enviar. O envio sem revisão no modo `auto` continua inexistente (RF-027
> é Fase 6). O transporte Meta -> inbox também foi comprovado com mensagem
> real em stage.
> As quatro divergências D1-D4 levantadas na auditoria foram corrigidas
> localmente e estão registradas na seção "Divergências resolvidas" abaixo.
> Com o bot habilitado, toda mensagem real hoje termina
> em `suppressed`, `handoff`, `blocked` ou `draft`. O clique controlado em
> Enviar/Descartar e toda a Fase 6 seguem pendentes. Nenhum item é marcado como
> `ok` sem teste ou log correspondente.

## Matriz de rastreabilidade

| ID | Tipo | Evidência planejada | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | teste de fila: inbound de texto cria 1 job `pending` com `scheduled_for` futuro | ok — `test_whatsapp_bot_queue_service.test_enqueue_cria_job_pending_com_debounce` |
| CA-002 | aceitação | teste de fila: segundo POST com o mesmo `wa_message_id` não cria job | ok — `test_whatsapp_bot_queue_service.test_reentrega_do_mesmo_wa_message_id_nao_cria_segundo_job` |
| CA-003 | aceitação | teste de debounce: 3 mensagens -> 2 jobs `superseded` + 1 ativo, 1 resposta | ok (debounce/supersede) — `test_whatsapp_bot_queue_service.test_mensagem_nova_supersede_job_pending_anterior_da_mesma_conversa`; a parte "1 resposta" só existe a partir da Fase 4 (geração), aqui o job ativo termina em `suppressed` (P2.4) |
| CA-004 | aceitação | teste do endpoint: enfileiramento com exceção forçada mantém `200` e as contagens do push | ok — `test_whatsapp_bot_webhook_enqueue.test_falha_no_enfileiramento_mantem_contagens_do_push_e_bot_job_enqueued_false` (chamada direta da funcao do endpoint; nao ha teste HTTP via TestClient neste modulo, seguindo o padrao já usado no resto da suíte) |
| CA-005 | aceitação | teste dos portões com cada interruptor em `false`: 0 jobs processados, 0 envios | ok (interruptor combinado RF-008) — `test_whatsapp_bot_gates.test_is_whatsapp_bot_enabled_exige_env_e_banco` (env off, banco off, os dois) + `test_whatsapp_bot_process_job.test_bot_desabilitado_suprime_sem_chamar_node` (job vira `suppressed`, zero chamadas ao Node) |
| CA-006 | aceitação | teste do worker em `suggest`: decisão `draft`, cliente HTTP do Node nunca chamado | parcial — `test_whatsapp_bot_generation.test_resposta_aprovada_em_suggest_vira_rascunho_sem_envio` asserta `draft`/`motivo=modo_suggest`, mas no nível do gerador: nenhum teste de worker chega a `draft` (o único que abre todos os portões termina em `handoff`/`identidade_nao_resolvida`). A frase "cliente HTTP do Node nunca chamado" está errada como escrita — o worker chama o Node (`httpx.get`) em todo job que chega à geração; o que não existe é envio (`httpx.post`), por ausência de código, não por asserção. `assertIsNone(resultado.texto_enviado)` é asserção de default de dataclass: nada no código atribui `texto_enviado` |
| CA-007 | aceitação | teste de pausa: mensagem humana -> `pausado_ate` no futuro, próximo job `suppressed` | ok — `test_whatsapp_bot_process_job.test_resposta_humana_from_me_pausa` (detecta `from_me=true` no Node e pausa) e `test_pausa_local_ainda_vigente_suprime_sem_chamar_node` (pausa já vigente localmente) |
| CA-008 | aceitação | teste de janela: `last_inbound_at` com mais de 24h -> `suppressed` | ok — `test_whatsapp_bot_process_job.test_janela_de_24h_fechada_suprime` + `test_whatsapp_bot_gates.test_customer_service_window` (unitário, replica `describeCustomerServiceWindow`) |
| CA-009 | aceitação | teste por tipo: `audio`/`image`/`document` -> `handoff` sem geração | ok — `test_whatsapp_bot_process_job.test_tipo_nao_suportado_vira_handoff_sem_alerta` + `test_whatsapp_bot_gates.test_is_supported_message_type` (audio/image/document/sticker/reaction/interactive/button, todos `False`) |
| CA-010 | aceitação | teste de pedido de humano: `pending` no Node, alerta criado, provider de LLM não chamado | ok — `test_whatsapp_bot_process_job.test_pedido_de_humano_dispara_handoff_com_alerta_patch_e_push` (PATCH status=pending, alerta `nivel=aviso`, push chamados; nenhum provider de LLM existe ainda nesta fase para "não chamar") |
| CA-011 | aceitação | teste de emergência: resposta fixa, `criar_alerta_interno(nivel="critico")`, gerador não chamado | ok — `test_whatsapp_bot_process_job.test_emergencia_dispara_handoff_critico_com_alerta_patch_e_push` (texto fixo em `texto_gerado`, alerta `nivel=critico`, `handoff_motivo=emergencia`) + `test_emergencia_ignora_pausa_e_janela_fechada` (prioridade sobre os outros portões) |
| CA-012 | aceitação | teste do nono dígito em `test_whatsapp_conversation_context.py`: `matched` para as duas formas | ok — `test_resolve_tutor_and_pet` (forma local, já existia) + `test_resolve_tutor_pela_identidade_canonica_sem_nono_digito` (forma canonica do Node, novo) |
| CA-013 | aceitação | teste de escopo: contexto `ambiguous`/`not_found` -> resposta sem dado de registro | ok — `test_identidade_nao_resolvida_nao_chama_provider`, `test_identidade_ambigua_nao_chama_provider_nem_expoe_candidatos` e `test_todos_portoes_abertos_com_identidade_nao_resolvida_vira_handoff`; nos dois estados o provider não é chamado e nenhum candidato entra em `texto_gerado` |
| CA-014 | aceitação | teste de allowlist: intent fora da lista em conversa `auto` -> `draft` | ok — `test_intent_fora_da_allowlist_em_auto_vira_rascunho` grava `draft/intent_fora_allowlist`; `test_intent_fora_da_allowlist_em_suggest_continua_editavel` prova que o modo copiloto mantém o texto editável |
| CA-015 | aceitação | teste do validador: candidata com conteúdo clínico -> `blocked` + motivo gravado | ok — `test_conteudo_clinico_gerado_vira_blocked_com_motivo`, `GuardrailBloqueioClinicoTest` e `test_resultado_do_gerador_e_persistido_com_auditoria_completa`, que relê `decisao`, `motivo`, texto, modelo, prompt, tools, tokens, latência e contexto da linha persistida |
| CA-016 | aceitação | teste de fonte: sem tool e sem trecho recuperado -> não envia | ok local — `test_sem_fonte_nao_responde` e `test_tool_sem_relacao_nao_conta_como_fonte_da_intent`; no fluxo completo, `test_tool_sem_relacao_nao_autoriza_status_de_laudo` prova que horário não serve de fonte para laudo. Smoke real de preço confirmou a tool específica; status e stage seguem pendentes |
| CA-017 | aceitação | teste de teto: acima do limite diário -> `suppressed` com motivo de teto | ok — `test_whatsapp_bot_generation.test_teto_diario_suprime_antes_de_gastar_token` (decisão `suppressed`, motivo `teto_diario`, `provider.generate` não chamado); teto aplicado em `whatsapp_bot_generation.py:127-135` antes de gastar token. Ressalva: `contar_respostas_do_dia` só soma `decisao == "sent"`, que não é alcançável até a Fase 6 — em tráfego real o contador é sempre 0 hoje |
| CA-018 | aceitação | teste de envio em `auto`: chamada ao Node com `metadata.origem = "bot"` | parcial — o transporte para rascunho de `suggest` aprovado por humano está implementado e testado: backend envia `origem=bot`, `source=bot_suggest_reviewed`, `resposta_id` e chave idempotente; Node aceita somente via token interno. O envio sem revisão em `auto` continua pendente e bloqueado até a Fase 6; `test_aprovada_em_auto_ainda_nao_envia_nesta_fase` preserva esse limite |
| CA-019 | aceitação | teste do preview: nenhum job alterado, nenhuma geração, nenhum envio | ok — `test_whatsapp_bot_endpoints.test_preview_nao_altera_nada_e_conta_por_status_e_decisao` (endpoint é só leitura/agregação; contagens de jobs/respostas antes e depois idênticas) |
| CA-020 | aceitação | teste de autorização em `test_configuracoes_autorizacao.py` (403 para não admin) + smoke sem restart | ok — 5 testes novos em `test_configuracoes_autorizacao.py` (403 para `whatsapp_bot_atendimento_habilitado` e `whatsapp_bot_modo`, 422 para modo invalido, reenvio sem mudança permitido para não-admin, admin habilita e muda modo); "sem restart" decorre de `is_whatsapp_bot_enabled()`/`resolve_conversation_mode()` lerem o banco a cada chamada, sem cache — não medido em stage real |
| CA-021 | aceitação | teste do worker com advisory lock ocupado: ciclo pulado, 0 jobs tocados | ok — `test_whatsapp_bot_worker_service.test_run_due_once_pula_ciclo_com_lock_distribuido_ocupado` |
| CA-022 | aceitação | teste de redação de log: corpo completo e número completo ausentes da saída | ok local — `_fetch_conversation_by_phone` relança erro sem URL e `run_due_once` persiste/loga somente `_safe_job_error`; `test_falha_nao_vaza_telefone_em_log_nem_last_error` usa `assertLogs` e relê `last_error`, sem encontrar o telefone completo |
| CA-023 | aceitação | teste de escopo entre personas: conversa `clinica` sem dado de tutor de outra clínica, e vice-versa | ok local — testes de tools provam laudos por tutor/clínica e `test_whatsapp_bot_context` cobre agendamentos por persona, inclusive cadastro inconsistente com `tutor_id` correto e `pet_id` de terceiro; o loop real agora alcança as tools escopadas |
| CA-024 | aceitação | teste de allowlist: intent de OS/cobrança em `auto` -> `draft` nas duas personas | ok — `GuardrailAllowlistDeIntentTest.test_bloco_comum_sempre_vira_rascunho_nas_duas_personas`, `test_intent_fora_da_allowlist_em_auto_vira_rascunho` e `test_contexto_do_prompt_nao_carrega_ordem_de_servico` |
| CA-025 | aceitação | teste de handoff: fora da janela informa próximo horário; dentro, informa transferência; emergência mantém contato imediato | ok — `test_whatsapp_bot_handoff_service.py`: dentro do expediente (`test_build_handoff_message_dentro_do_expediente_informa_transferencia`), fora dele com o próximo horário (`..._fora_do_expediente_informa_proximo_horario`, `..._tarde_de_sabado_aponta_segunda`); emergência usa `EMERGENCY_FIXED_MESSAGE` sempre, independente de horário (`test_whatsapp_bot_process_job.test_emergencia_ignora_pausa_e_janela_fechada`) |
| CA-026 | aceitação | teste de corrida: claim durante o debounce -> job `suppressed`, sem envio e sem rascunho | ok — `test_whatsapp_bot_process_job.test_claim_detectado_no_node_pausa_e_grava_estado_local` (`last_agent_id` preenchido no Node -> `suppressed`/`pausado`, nenhum PATCH/alerta/push chamado) |
| NFR-001 | não funcional | inspeção de `config.py`/`.env.example`/migração: todos os defaults desligados | ok — `WHATSAPP_BOT_ENABLED=False` (`backend/app/core/config.py`), `whatsapp_bot_atendimento_habilitado`/`whatsapp_bot_modo` nascem `false`/`suggest` (migração `20260820_75`, testado em `test_whatsapp_bot_migration.test_upgrade_adiciona_colunas_em_configuracoes_com_default_seguro`) |
| NFR-002 | não funcional | medição do tempo do endpoint de mensagem recebida antes e depois do enfileiramento | ok (ordem de grandeza) — 30 chamadas locais em sqlite, com enfileiramento: média 2.77ms / p95 0.98ms; sem os campos novos (payload antigo): média ~0ms. Bem abaixo do orçamento de ~50ms; não é uma medição de stage/produção com Postgres real |
| NFR-003 | não funcional | `build_runtime_report()` expondo `whatsapp_bot_worker` | ok — `report["observability"]["whatsapp_bot_worker"]` com `enabled`, `status`, `thread_alive`, `worker_started`, `stop_signal_set`, `poll_seconds`, `pending_jobs`, `last_cycle_at`, verificado por inspeção direta (`build_runtime_report()`) e pela suíte completa (nenhuma regressão nos demais workers) |
| NFR-004 | não funcional | revisão dos logs emitidos em um ciclo completo em stage | parcial — redação local comprovada por `test_falha_nao_vaza_telefone_em_log_nem_last_error`; revisão de um ciclo real em stage continua pendente |
| NFR-005 | não funcional | contadores de custo por conversa em `whatsapp_bot_respostas` + degradação para `suggest` | ok local — usage é somado em todas as rodadas e persistido (teste de auditoria completa); `WHATSAPP_BOT_MAX_TOKENS_PER_DAY=100000` soma input+output global do dia e, no teto, cria `draft/teto_global_tokens` sem chamar o provider (`test_teto_global_de_tokens_degrada_para_draft_antes_do_provider`) |
| NFR-006 | não funcional | teste de migração idempotente (aplicar duas vezes, e no-op sem tabela) | ok — `backend/tests/test_whatsapp_bot_migration.py` (4 testes: tabelas+índices, unicidade de `wa_message_id`, colunas em `configuracoes` com default seguro, no-op sem `configuracoes`), rodado duas vezes em sequência em cada teste |
| NFR-007 | não funcional | inspeção: nenhuma query do backend principal em `conversations`/`messages` | ok — a reconciliação (`whatsapp_bot_worker_service.run_reconciliation_sweep`) só fala com o Node via `httpx` + `x-whatsapp-internal-token` (`GET /conversations`, `GET /conversations/:id/messages`); nenhum acesso direto ao Postgres do whatsapp-stage-backend em nenhum arquivo desta fase |
| NFR-008 | não funcional | repetição/concorrência de envio assistido não chama a Graph API duas vezes | ok local — backend faz claim condicional `draft -> sending`, repetição após `sent` é idempotente e falha de transporte restaura `draft`; Node serializa por advisory lock e índice único parcial de `idempotency_key`, retorna o existente em `sent`/`delivered`/`read` e falha fechado em `pending`. Coberto por `test_enviar_rascunho_editado_e_idempotente`, `test_falha_no_node_devolve_rascunho_para_revisao` e `test:inbox-ui` |

## Divergências resolvidas (auditoria da Fase 4, 2026-08-23)

- **D1 resolvida:** intent fora da allowlist agora produz `draft`, nunca
  `blocked` apenas por inelegibilidade ao modo automático.
- **D2 resolvida:** `GuardrailVeredito` separa `aprovado` (segurança editorial)
  de `auto_elegivel`; em `suggest`, resposta segura continua editável.
- **D3 resolvida:** o provider devolve `function_call`, o orquestrador
  executa a tool escopada, anexa `function_call_output` e reenvia todo o estado
  com `store=False`, por no máximo duas rodadas. Fonte agora é específica por
  intent; preço/status são renderizados do payload literal. O contrato foi
  confirmado em smoke local real com `consultar_preco_tabela`; stage permanece
  pendente.
- **D4 resolvida localmente:** falhas HTTP por telefone são relançadas sem URL,
  e logs/`last_error` passam por redação; teste com `assertLogs` cobre o número
  completo.

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
venv/bin/python -m unittest tests.test_whatsapp_bot_providers -v
venv/bin/python -m unittest tests.test_whatsapp_bot_guardrails -v
venv/bin/python -m unittest tests.test_whatsapp_bot_tools -v
venv/bin/python -m unittest tests.test_whatsapp_bot_context -v
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

Resumo dos resultados (Fase 4, 2026-08-23):
- Backend: `test_whatsapp_bot_generation` (10/10), `test_whatsapp_bot_guardrails`
  (17/17), `test_whatsapp_bot_tools` (20/20), mais `test_whatsapp_bot_process_job`
  (11/11, um teste reescrito: o caminho de "todos os portões abertos" agora
  termina em `handoff`/`identidade_nao_resolvida` em vez do stub da Fase 3).
  `unittest discover -s tests -p "test_*.py"` completo: **956/956, 0 falha** —
  cresceu de 909 para 956 com os 47 testes novos desta fase, sem regressão.
- Nenhum teste desta fase usa rede: o provider é sempre um fake injetado por
  parâmetro em `gerar_resposta(..., provider=...)`, no padrão dos providers
  protocolares do ai-echo.
- **Critério de conclusão da fase NÃO cumprido.** O plan.md pede "em stage, com
  conversa em `suggest`, rascunhos reais aparecem gravados e nenhum envio
  acontece". A metade "nenhum envio" é verdadeira por ausência de código de
  envio; a metade "rascunhos reais em stage" não foi executada — não houve
  nenhuma chamada a provider real, em stage ou fora dele. D1-D4 eram as
  divergências encontradas nessa auditoria e foram corrigidas na rodada abaixo.
- Serviço WhatsApp: não tocado nesta fase. A mudança que a RF-027 exige
  (`sendConversationMessage` aceitar `metadata` do chamador, hoje cravado em
  `{source: "agent_api"}`) continua por fazer e é pré-requisito da Fase 6.
- Frontend: não tocado nesta fase (é a Fase 5).

Resumo da correção da auditoria (2026-08-23):
- D1-D4 corrigidas localmente: allowlist gera rascunho, `suggest` mantém texto
  editável, loop stateless de tools alcança preço/status, fonte é específica por
  intent e erro/log não carrega telefone completo.
- Cobertura adicionada para provider stateless, tool loop, preço determinístico,
  fonte sem relação, identidade ambígua, teto global de tokens, limite de
  rodadas, persistência integral da auditoria, logs sem PII e agendamentos
  escopados por persona.
- A chave `WHATSAPP_BOT_MAX_TOKENS_PER_DAY=100000` impede nova chamada paga ao
  atingir o total diário e cria `draft/teto_global_tokens` para revisão humana.
- Validação final local: backend completo **971/971**, 0 falha/erro; serviço
  Node com `npm run build`, `npm run test:phone-number` e
  `npm run test:inbox-ui` aprovados. O frontend não foi tocado nesta correção.
- Smoke local real em `suggest`: `gpt-5.6-sol`, decisão `draft`, motivo
  `modo_suggest`, tool tentada/confirmada `consultar_preco_tabela`, 2.462 tokens
  de entrada, 199 de saída e 8.735 ms; texto gerado presente e nenhum caminho de
  envio executado. A chave nova foi gravada somente no `backend/.env` ignorado.
- O transporte real de stage foi testado em 2026-08-23: app publicado, callback
  e `messages` confirmados, FortZap Stage inscrito na WABA e inbound persistido
  na inbox como `Recebida`, sem resposta automatica. Isso valida transporte,
  nao o pipeline Python do chatbot.
- O critério de conclusão do backend da Fase 4 foi fechado pelo rascunho real
  persistido em stage. Torná-lo visível e operável na central é a Fase 5.

## Validação e publicação da Fase 5 (2026-08-23)

- Central: rascunho pendente acima do composer com **Enviar**, **Editar e
  enviar** e **Descartar**; aviso e bloqueio de texto livre fora da janela de
  24h; polling do estado do bot; modo/pausa por conversa; selo próprio na
  timeline para envio assistido.
- Configurações -> Empresa: toggle institucional e modo padrão, com gravação
  somente por admin. `auto` está visível, mas desabilitado até a Fase 6.
- Backend Python: endpoints de enviar/descartar, claim atômico
  `draft -> sending`, feedback, texto efetivo, atendente, pausa após envio,
  auditoria e restauração para `draft` em falha de transporte.
- Serviço Node: metadata do bot aceito apenas com `internal_token`, chave
  idempotente vinculada ao `resposta_id`, advisory lock transacional e índice
  único parcial. Repetições de mensagem já `sent`/`delivered`/`read` retornam a
  linha existente; `pending` falha fechado sem nova chamada à Graph API.
- Testes executados: **119/119** testes `test_whatsapp_bot*.py`, **9/9** de
  autorização de Configurações, `npm run build` e `npm run test:inbox-ui` no
  serviço Node, ESLint focado, `tsc --noEmit` e `next build` no frontend — tudo
  aprovado. A suíte completa do backend terminou em **974/974**, sem falhas;
  `npm run test:phone-number` e `git diff --check` também passaram.
- Publicação: fast-forward de `origin/stage` para
  `0256685177380ff62b247ef0719ad43086267ae5`. `Deploy to Stage (VPS)` run
  `32661248713` e `Migration CI` run `32661248721` terminaram em `success`.
  SDD guardrail, quality gate, suíte completa, builds e testes Node passaram.
- O deploy registrou `Migration applied successfully`, health do backend
  WhatsApp, readiness, canário autenticado e restore drill aprovados. Na VPS,
  backend, frontend e WhatsApp estavam `active`; o índice
  `ux_messages_bot_idempotency_key` foi confirmado como presente.
- Runtime preservado: `WHATSAPP_BOT_ENABLED=true`, toggle institucional `true`,
  modo `suggest`. O modo `auto` permaneceu desabilitado na interface.
- Smoke HTTP: raiz e health de stage `200`; `/whatsapp-stage` redireciona do
  domínio canônico para `app.stage` (`307`) e termina em `200`; rota protegida
  `/whatsapp/conversations` retorna `401` sem credencial.
- Bundle servido: todos os chunks referenciados pelo HTML de
  `/whatsapp-stage` e `/configuracoes` foram baixados; os marcadores do selo,
  copiloto, rascunho e card institucional estavam presentes (acentos aparecem
  escapados no JavaScript minificado).
- Smoke autenticado no Chrome: a conversa Martiniano Barros exibiu o rascunho
  real com **Enviar**, **Editar e enviar** e **Descartar**; o painel de copiloto
  mostrou origem institucional e pausa por 12h. A edição abriu com o texto
  preservado e foi cancelada, retornando ao estado de revisão. O card de
  Configurações estava visível, toggle ligado, `suggest` selecionado e `auto`
  desabilitado. Nenhum erro de console foi observado.
- Depois de autorização explícita, o clique em **Enviar** foi executado uma
  vez. A Meta recusou o destinatário com HTTP `400`,
  `OAuthException/131030` (`Recipient phone number not in allowed list`): a
  conversa interna estava na forma brasileira sem nono dígito, enquanto o
  destinatário de teste permitido estava cadastrado com ele. A tentativa não
  recebeu `wa_message_id`; a única linha Node ficou `failed`, e a resposta
  Python voltou a `draft`, sem `texto_enviado`, feedback ou atendente gravado.
  **Enviar edição** e **Descartar** não foram acionados.
- Produção permaneceu no SHA `447ddc53`; raiz e health `200`, rota protegida
  `401`. Nenhum deploy ou configuração de produção foi alterado.

### Correção do destinatário Graph após o primeiro envio controlado

- `whatsappGraphRecipient` preserva a identidade canônica da conversa, mas
  recompõe o nono dígito para celulares brasileiros antes de enviar texto ou
  anexo à Graph API. Fixos brasileiros e números internacionais não mudam.
- `npm run test:phone-number` cobre as duas formas do celular, fixo e número
  internacional; `npm run build` do serviço Node passou.
- Publicado somente em stage no SHA
  `5f6ca72b55170bc2820b296b3e66d299199b42d1`. `Deploy to Stage (VPS)` run
  `32662352928` e `Migration CI` run `32662352859` terminaram em `success`;
  quality gate, SDD guardrail, suíte completa, frontend e testes Node ficaram
  verdes.
- A VPS confirmou o mesmo SHA, os três serviços `active` e a transformação
  móvel com 13 dígitos, sem alterar fixo brasileiro ou número internacional.
  Raiz e health de stage retornaram `200`; a rota protegida retornou `401`.
- A inbox autenticada continuou mostrando a conversa Martiniano Barros, a
  linha `Falhou`, o botão **Reenviar** e o rascunho original com **Enviar**.
- Após nova confirmação explícita, **Reenviar** foi clicado exatamente uma
  vez. A Meta aceitou a mensagem e o webhook confirmou `delivered`, com ID
  externo, na linha Node `2437`. Não houve outro clique nem nova tentativa.
- O botão genérico havia usado `source=agent_api`, criando uma segunda linha em
  vez de concluir a resposta Python. O estado foi reconciliado sem chamada à
  Meta: a linha entregue recebeu metadata do bot e a chave
  `whatsapp-bot-resposta-7`; a falha histórica `2430` foi marcada como
  substituída; a resposta `7` passou a `sent`, com texto efetivo, feedback
  positivo, atendente e pausa. Um evento
  `RECONCILIAR_REENVIO_RASCUNHO` foi gravado; a inbox deixou de exibir o
  rascunho pendente e mostrou a entrega com selo do bot.
- Correção preventiva: mensagens falhas com `source=bot_suggest_reviewed`
  passam a chamar `/api/v1/whatsapp/bot/respostas/{id}/enviar`; tentativas
  substituídas não oferecem **Reenviar**. O teste focado da página passou
  **19/19**, além de ESLint e `tsc --noEmit`.
- A correção preventiva foi publicada somente em stage no SHA
  `29f68f2295864bd42de4a6947ba02fbb8344adf1`. `Deploy to Stage (VPS)` run
  `32663269023` e `Migration CI` run `32663268982` terminaram em `success`;
  SDD guardrail, quality gate, suíte backend, lint/build frontend e testes Node
  ficaram verdes. A VPS confirmou o mesmo SHA e os três serviços `active`.
- No smoke pós-deploy, raiz e health de stage retornaram `200` e a rota
  protegida `/whatsapp/agents` retornou `401`. A tela autenticada mostrou uma
  entrega com selo do bot, nenhuma região de rascunho pendente e zero botões
  **Reenviar**, preservando a falha apenas como histórico.
- A verificação persistida confirmou exatamente duas linhas para o mesmo corpo
  desde a tentativa original: `2430` em `failed`, substituída por `2437`, e
  `2437` em `delivered` com ID externo e chave idempotente. A resposta `7`
  permaneceu `sent`, com feedback positivo e atendente, e existe exatamente um
  evento `RECONCILIAR_REENVIO_RASCUNHO`.
- Produção permaneceu em `447ddc53`, com raiz/health `200` e rota protegida
  `401`; nenhum push ou deploy de produção foi executado.

## Smoke E2E real do chatbot em stage (2026-08-23)

- `RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh` executado na VPS:
  `PASS`, 0 falhas e 0 avisos; assinatura obrigatória, identidade Meta, app
  inscrito na WABA, autenticação, serviços, HTTP e idempotência aprovados.
- Preview antes da ativação: `whatsapp_bot_enabled_env=false`, toggle do banco
  `false`, `whatsapp_bot_ativo=false`, modo `suggest`; após o smoke sintético,
  nenhum job permaneceu pendente.
- O primeiro inbound com o bot ativo terminou em
  `handoff/identidade_nao_resolvida`, `resolution=ambiguous`, antes do provider:
  zero tokens e nenhum texto gerado/enviado. O mesmo contato estava em duas
  clínicas (IDs 8 e 51) e um tutor (ID 192), confirmando o fail-closed da
  RF-016.
- Após confirmação explícita, o contato foi removido somente das duas clínicas
  em stage e preservado no tutor ID 192. A transação só foi confirmada depois
  de `resolve_whatsapp_context` retornar `matched/tutor`; dois eventos de
  auditoria `REMOVER_CONTATO_AMBIGUO_STAGE` foram gravados sem o número.
- Segundo inbound: job `21`, `done`, tentativas `0`, sem erro; decisão
  `draft`, motivo `modo_suggest`, resolução `matched/tutor`, modelo
  `gpt-5.6-sol`, prompt `whatsapp-bot-v1-tutor-95dba6ab`, tool tentada e
  confirmada `consultar_preco_tabela`, 2.592 tokens de entrada, 280 de saída e
  latência de 11.794 ms.
- O rascunho persistido informou o valor literal de tabela do ecocardiograma.
  `texto_enviado` permaneceu vazio. Consulta independente à tabela `messages`
  na janela do job encontrou um inbound `text/received` e zero linhas
  `from_me`, comprovando ausência de resposta automática.
- Runtime ao final: `WHATSAPP_BOT_ENABLED=true`, toggle do banco `true`, modo
  institucional `suggest`, backend saudável. Produção não foi alterada.

## Testes manuais planejados (stage)

1. [concluído] Preview com o bot desligado antes da habilitação, sem geração ou
   envio.
2. [concluído] Conversa real em `suggest`: rascunho persistido, exibido,
   revisado e reenviado após duas confirmações explícitas. A primeira tentativa
   foi recusada antes da aceitação; o reenvio único após a normalização Graph
   chegou a `delivered`. Estado Python/Node reconciliado e auditado. Descartar
   permanece como caso separado, sem necessidade para comprovar o envio.
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

### Instrumentação entregue (P6.1 e P6.5, 2026-08-23)

Estes dois itens do `plan.md` passam de pendentes a implementados. A coleta em
si (P6.3) continua pendente por depender de uma semana de tráfego real.

**P6.1 — casos de regressão dos guardrails.**
`backend/evals/whatsapp_bot_cases.json` (27 casos) e o teste de contrato
`backend/tests/test_whatsapp_bot_evals.py` (9 testes, todos ok). O dataset é
avaliado por `avaliar_resposta` **sem LLM e sem rede**: cada caso declara o
texto candidato, o estado do turno e o veredito esperado
(`aprovado`, `auto_elegivel`, `motivo`). Cobertura verificada por teste:

- os quatro grupos clínicos (`diagnostico`, `dose_medicacao`, `prognostico`,
  `avaliacao_sintoma`), incluindo o caso em que a resposta está ancorada em
  trecho da base — "veio da base" não é passe livre;
- `vazamento_conteudo_laudo`;
- `sem_fonte`, inclusive os dois casos em que a fonte existe mas é **de outra
  intent** (horário não autoriza preço; dados institucionais não autorizam
  laudo);
- `valor_fora_tabela` e `prazo_nao_confirmado`, com os pares aprovados
  correspondentes (valor e horário ancorados no retorno literal da tool);
- `intent_fora_allowlist` para todo o bloco comum da CA-024 nas duas personas,
  mais as intents cruzadas de persona (`como_agendar` na clínica,
  `como_solicitar_exame` no tutor) e `outro`;
- `teto_caracteres`;
- pelo menos um caso aprovado e auto-elegível em cada persona.

`teto_diario` é a única exceção declarada no teste de cobertura: depende de
contagem no banco, não de texto candidato, e já é coberto por
`test_whatsapp_bot_generation.test_teto_diario_suprime_antes_de_gastar_token`.

Dois guards adicionais protegem a integridade da métrica por motivo:
`avaliar_resposta` usa o **nome do grupo** da deny-list como `motivo` com um
`type: ignore`, então um grupo novo no JSON com nome fora de `MotivoBloqueio`
passaria em runtime e sujaria a agregação sem quebrar teste algum. O teste
`test_grupo_da_deny_list_sempre_mapeia_para_motivo_do_literal` fecha isso, e
`test_deny_list_nao_tem_termo_vazio_nem_generico_demais` recusa termo vazio ou
de 1 caractere. Ambos foram verificados como **não vazios**: simulando um grupo
`conteudo_experimental`, `avaliar_resposta` de fato produz
`motivo="conteudo_experimental"`, fora do `Literal`.

**P6.5 — métricas de observação.**
`backend/app/services/whatsapp_bot_metrics_service.py` e
`GET /api/v1/whatsapp/bot/metricas?dias=7`, cobertos por
`backend/tests/test_whatsapp_bot_metrics.py` (9 testes, todos ok). Nenhuma
migração foi necessária: todas as métricas são deriváveis das colunas que já
existem.

Decisões de medição que mudam a leitura do número e por isso ficam registradas:

- **Aceite com edição é distinguido do aceite limpo.** O endpoint de envio
  grava `feedback="positivo"` mesmo quando o atendente reescreveu o texto, logo
  o feedback sozinho superestima a qualidade do rascunho. A métrica deriva
  "editado" de `texto_enviado != texto_gerado` e expõe `taxa_aceite`,
  `taxa_aceite_sem_edicao` e `taxa_edicao_entre_aceitos` separadamente.
- **Rascunho pendente não entra no denominador do aceite.** Só rascunho já
  decidido (enviado ou descartado) conta; senão a taxa começaria baixa e subiria
  sozinha conforme a equipe trabalha, medindo backlog em vez de qualidade.
- **Faixa de horário usa a janela operacional da agenda**
  (`is_within_operating_window`), a mesma fonte do texto de handoff da RF-033,
  para "dentro/fora do expediente" não divergir do que o cliente ouve. Vale a
  limitação já registrada no CB-010: essa janela é proxy do horário em que
  alguém lê o inbox.
- **Custo não finge zero.** Com `WHATSAPP_BOT_*_COST_PER_MILLION=0.0` (default),
  `custo_configurado=false` e `custo_total`/`custo_por_conversa` vêm `null`.
  Tokens continuam somados e reportados.
- **`pronto_para_decidir_auto` é checklist, não autorização.** Reporta
  `decididos_por_persona`, o mínimo adotado (`20` por persona) e quais personas
  atingiram amostra. `test_checklist_de_auto_nunca_autoriza_sozinho` fixa que o
  campo não habilita nada; ligar `auto` continua exigindo autorização humana
  explícita registrada aqui.

A classificação de faixa de horário é memoizada em `_ClassificadorDeFaixa`:
`is_within_operating_window` recarrega `Configuracao` e reparseia o JSON da
agenda a cada chamada, o que numa janela de uma semana seria uma consulta e um
parse por resposta agregada. As regras passam a ser lidas uma vez e a janela do
dia fica memoizada por data. A equivalência com a fonte da RF-033 é travada por
`test_classificador_memoizado_equivale_a_funcao_original`, que compara os dois
caminhos em 168 pontos (7 dias × 24 horas, cobrindo dia útil, sábado, domingo,
antes de abrir, dentro e depois de fechar), e
`test_classificador_consulta_a_agenda_uma_unica_vez` fixa a contagem de 1
consulta para 25 respostas.

Suítes após esta entrega: **994/994** na suíte completa do backend (era 974),
**139/139** na suíte focada do bot (era 119) e **15/15** em
`test_whatsapp_conversation_context` + `test_configuracoes_autorizacao`.

### Publicação da instrumentação da Fase 6 em stage (2026-08-23)

Publicado após autorização explícita, por fast-forward, sem force:

- `origin/stage` avançou `29f68f22..b8b4875c` (6 commits: 5 desta sessão mais o
  commit documental `6a19d9b6` que já estava na branch; conferido como
  docs-only antes de publicar);
- a branch `claude/whatsapp-chatbot-handoff-2d02ad` também foi publicada, para
  rastreabilidade;
- `origin/main` e produção permaneceram em `447ddc53`, sem alteração.

Workflows terminais no SHA `b8b4875c`:

- Deploy to Stage (VPS) run `32664954776`: `success`;
- Migration CI run `32664954786`: `success`.

Revalidação externa antes e depois, sem autenticação, com resultado idêntico:

| Alvo | Antes | Depois |
| --- | --- | --- |
| `stage.fortcordis.com.br/` | `200` | `200` |
| `app.stage.../whatsapp/health` | `200` | `200` |
| `app.stage.../whatsapp/conversations` sem credencial | `401` | `401` |
| `stage.../whatsapp-stage` | — | `307` (redirect de autenticação) |
| produção `app.fortcordis.com.br/` | `200` | `200` |
| produção `/whatsapp/health` | `200` | `200` |
| produção `/whatsapp/conversations` sem credencial | `401` | `401` |

Prova de que o endpoint novo entrou no runtime, sem precisar de credencial: em
`app.stage` e em `stage`, `GET /api/v1/whatsapp/bot/metricas` responde `401`,
**igual** ao `GET /api/v1/whatsapp/bot/preview` que já existia, enquanto uma
rota inexistente (`/api/v1/whatsapp/bot/nao-existe-xyz`) responde `404`. Ou
seja, a rota existe e está protegida — não é `404` de código ausente.

O bot continua em `suggest`; nada foi habilitado, enviado ou reenviado nesta
publicação.

### Pendente na Fase 6

- P6.2: `GET /whatsapp/bot/preview` executado e revisado em stage.
- P6.3: uma semana de tráfego real em `suggest`, com os números acima
  coletados e transcritos nesta seção.
- P6.4: decisão de `auto` registrada com número, após autorização explícita.
- Teste real de `consultar_status_laudo` em stage, sem conteúdo clínico na
  mensagem e sem envio automático.

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

- [x] Aprovado para stage em `suggest` para continuidade da Fase 5.
- [ ] Aprovado para produção em modo `suggest`.
- [ ] Aprovado para produção em modo `auto` (allowlist da RF-019).
- [ ] Não aprovado (descrever motivo).
