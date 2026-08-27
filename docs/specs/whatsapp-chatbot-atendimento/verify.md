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

A publicação ocorreu em dois ciclos, ambos por fast-forward e ambos com os dois
workflows terminais em `success`:

| SHA | Conteúdo | Deploy to Stage | Migration CI |
| --- | --- | --- | --- |
| `b8b4875c` | instrumentação da Fase 6 (código + specs) | `32664954776` | `32664954786` |
| `e1a92b95` | somente `handoff.md` e `verify.md` com as provas do 1º ciclo | `32665608058` | `32665608079` |

Ao final, `origin/stage`, o runtime de stage e a branch
`claude/whatsapp-chatbot-handoff-2d02ad` ficaram sincronizados. Este registro
cobre os dois ciclos de propósito: documentar cada commit documental em um novo
commit documental seria recursão sem valor, então o ciclo se encerra aqui.

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

### Regressão crítica corrigida: base institucional inalcançável (2026-08-23)

**O bug.** `buscar_conhecimento_institucional` comparava o `score` normalizado
de `search_knowledge` (teto `1.0`) contra um piso de `2.0`. O piso era
**matematicamente inalcançável**, então a tool devolvia `ok=False` para toda
pergunta e todo documento — inclusive um com categoria e fonte perfeitas.

**Impacto.** `_FONTE_EXIGIDA_POR_INTENT` amarra `area_atendimento`,
`como_agendar` e `como_solicitar_exame` a essa tool. Os três — exatamente os
intents que significam "como a FortCordis funciona", e 3 dos 7 auto-elegíveis
de cada persona — terminavam sempre em `blocked/sem_fonte`. Em `suggest` isso
ficou invisível: o atendente revisava o rascunho reprovado e respondia à mão,
sem perceber que a base nunca respondeu.

**Por que passou por três fases.** Nenhum teste ligava o wrapper ao retorno
real de `search_knowledge`; todos montavam `tools_ok` à mão.

**Prova numérica** (documento institucional realista, pergunta "como faço para
agendar uma consulta?"): `keyword_score = 13`, `score` normalizado `= 0.35`,
`semantic_score = None`. Piso antigo (`score >= 2.0`) → rejeita. Piso novo por
escala (`keyword_score >= 2.0`) → aceita.

**Correções.**

1. Piso aplicado na escala própria de cada sinal (`CONHECIMENTO_KEYWORD_SCORE_MINIMO`
   sobre `keyword_score`, `CONHECIMENTO_SEMANTIC_SCORE_MINIMO` sobre
   `semantic_score`), aceitando por qualquer um dos dois.
2. Allowlist de categoria tolerante (acento, caixa, hífen, underscore, sufixo)
   com casamento pela primeira palavra em `{institucional, atendimento}`.
   `manual` permanece **fora** de propósito — é o balde default compartilhado
   com procedimento clínico de staff.
3. Descarte deixou de ser silencioso: o retorno traz `motivo` e `descartados`
   por causa (`categoria`, `sem_fonte`, `pouco_relevante`), e um `logger.info`
   registra quando havia candidatos e todos foram descartados.

**Teste que fecha o caminho.** `backend/tests/test_whatsapp_bot_conhecimento.py`
(8 testes): documento institucional realista é recuperado de ponta a ponta;
categoria default `manual` é descartada com diagnóstico; documento sem fonte é
descartado com diagnóstico; seis variações de grafia de categoria são aceitas;
categorias de staff (`manual`, `operacao`, `procedimento`, `clinico`)
permanecem fora; base vazia e documento arquivado não estouram; e um guard
impede reintroduzir piso fora de escala. O teste **prova ausência de rede**:
`_embed_texts` recebe `side_effect=AssertionError`, então alcançar o caminho
semântico falha o teste em vez de fazer chamada paga em silêncio.

Suítes: **1002/1002** na completa do backend, **147/147** na focada do bot.

### Painel de configuração do bot (2026-08-23)

Interface pedida para o trabalho de alimentar e observar o bot deixar de ser
às cegas. Quatro seções num card em Configurações > Empresa, mais três
endpoints novos e uma lib de frontend.

**Backend** (`test_whatsapp_bot_painel.py`, 12 testes):

- `whatsapp_bot_readiness_service.py` + `GET /whatsapp/bot/prontidao`: sonda a
  tool que sustenta cada intent, por persona. **Zero chamada de LLM** — travado
  por `test_prontidao_nao_chama_llm`, que injeta `AssertionError` no provider.
  O valor está no diagnóstico: `test_prontidao_explica_categoria_errada_em_vez_de_so_dizer_nao`
  e `test_prontidao_explica_fonte_ausente` fixam que o painel diz *o que* está
  errado, em vez de só dizer que não sabe — que é precisamente o que deixou a
  regressão do piso de relevância passar por três fases.
- `GET /whatsapp/bot/conhecimento`: separa visível de ignorado pela mesma regra
  de audiência da tool (`test_listagem_separa_visivel_de_ignorado_pelo_bot`).
- `POST /whatsapp/bot/conhecimento` (admin): categoria derivada de `publico`,
  nunca digitada (`test_publico_define_categoria_sem_campo_livre` cobre os três
  valores), `publico` inválido é 422, e `fonte` é obrigatória no schema
  (`test_fonte_e_obrigatoria_no_schema`).
- `whatsapp_bot_simulation_service.py` + `POST /whatsapp/bot/simular`: executa a
  geração real e **não persiste nada** — `test_simulacao_nao_persiste_resposta`
  afirma `WhatsAppBotResposta.count() == 0` depois de uma simulação bem
  sucedida. Se gravasse, a simulação entraria no denominador de aceite e
  contaminaria o número que autoriza o modo `auto`.
- `gerar_resposta` ganhou `persona_forcada`, usado **somente** pela simulação:
  a identidade sintética resolve como `not_found` e o fluxo abortaria antes de
  exercitar as tools. O escopo aplicado é sintético (ids que nunca casam
  registro), e `test_persona_forcada_nao_vaza_dado_de_cliente` prova que
  `consultar_status_laudo` com esse escopo não alcança um laudo real semeado no
  banco.

**Frontend** (`lib/whatsapp-bot-painel.test.ts`, 12 testes):

- `formatarTaxa`/`formatarCusto`/`formatarLatencia`/`formatarInteiro` tratam
  `null` como `—` e tarifa ausente como `não configurado`. O teste
  `nunca transforma null em 0%` existe porque essa renderização ingênua faria
  "não medido" parecer "medido e ruim" para quem decide o `auto`.
- `resumirProntidao` separa `acionaveis` (o admin resolve cadastrando) de
  pendência que só se resolve em conversa real; sem isso o painel mostraria uma
  pendência permanente e treinaria o usuário a ignorar o vermelho.
- `linhasDoChecklist` transforma `pronto_para_decidir_auto` em lista de itens
  com a observação visível — nunca em selo de liberado.
- `validarConteudoBot` espelha as regras do backend antes de gastar requisição,
  incluindo a exigência de fonte.

**Validação executada**: backend **1014/1014**; frontend **98/98** em 15
arquivos; `eslint` sem warning em `configuracoes/page.tsx` e na lib nova;
`tsc --noEmit` limpo; `next build` concluído.

### Publicação do painel em stage (2026-08-23)

`origin/stage` avançou por fast-forward de `937d17b5` para `6f446d29` (painel
`7dca1d45` + registro documental `6f446d29`), depois de autorização explícita.

| Item | Evidência |
| --- | --- |
| Deploy to Stage | run `32670249325`, `success` |
| Migration CI | run `32670249345`, `success` |
| Backend antes de publicar | 1014/1014 |
| Frontend antes de publicar | 98/98, `eslint` sem warning, `tsc --noEmit` limpo, `next build` concluído |
| Gate SDD `origin/stage..HEAD` | `PASSED` |
| Stage antes e depois | raiz `200`, `app.stage/whatsapp/health` `200`, `/whatsapp/conversations` `401`, `/whatsapp-stage` `307` |
| Produção antes e depois | raiz `200`, health `200`, rota protegida `401`; `origin/main` inalterado em `447ddc53` nesta publicação |

> Nota de fim de sessão: `origin/main` avançou depois, de `447ddc53` para
> `683195bd`, por uma promoção alheia a este trabalho (PR #71, promoção do #70
> — agenda). Verificado que **nenhum arquivo `whatsapp_bot` existe em
> `origin/main`** (`git ls-tree -r --name-only origin/main | grep -c
> whatsapp_bot` → `0`, contra 38 em `origin/stage`). O bot continua sem nunca
> ter ido para produção.

### P6.2 — preview executado em stage (2026-08-23)

Executado no navegador autenticado (a sessão anterior havia expirado; o usuário
fez o login, nenhuma credencial foi digitada nem manipulada por agente).
`GET /api/v1/whatsapp/bot/preview` em `2026-08-23T22:32:00Z`:

| Campo | Valor |
| --- | --- |
| `whatsapp_bot_enabled_env` | `true` |
| `whatsapp_bot_atendimento_habilitado_banco` | `true` |
| `whatsapp_bot_ativo` | `true` |
| `whatsapp_bot_modo_institucional` | `suggest` |
| `jobs_por_status` | `superseded` 50, `done` 22 |
| `respostas_por_decisao` | `sent` 1, `handoff` 13, `suppressed` 8 |

Nenhum `draft` pendente: o único `sent` é a resposta `7`, já reconciliada, e não
foi tocada. **P6.2 fica cumprido.**

`GET /whatsapp/bot/metricas?dias=7` no mesmo instante, para o alcance real:
22 respostas, 12 conversas distintas, 1 rascunho decidido (persona `tutor`,
aceito sem edição), 13 handoffs — **todos** `identidade_nao_resolvida` — e 8
supressões (`bot_desabilitado` 5, `pausado` 3). Contenção geral `0,0714`;
latência p50/p95 `11.794 ms` com uma única amostra; `custo_configurado=false`.
`pronto_para_decidir_auto` reporta `decididos_por_persona={"tutor": 1}` contra o
mínimo de 20, `amostra_suficiente_nas_duas_personas=false`.

Isso confirma numericamente o reescopo do P6.3: em uma semana stage produziu
**um** rascunho decidido. O número de teste da Meta só fala com destinatários
pré-verificados, então a estatística de aceite tem que vir de produção em
`suggest`.

### Prontidão verificada em stage (2026-08-23)

Botão **Verificar** clicado em Configurações > Empresa, no painel publicado.
`GET /api/v1/whatsapp/bot/prontidao` respondeu `200`. Resumo: **14 itens, 8
prontos, 6 pendentes**, com `bot_ativo=true`.

| Intent | Tutor | Clínica | Fonte |
| --- | --- | --- | --- |
| Horário de funcionamento | pronto | pronto | `consultar_horario_funcionamento` |
| Endereço | pronto* | pronto* | `consultar_dados_institucionais` |
| Formas de contato | pronto* | pronto* | `consultar_dados_institucionais` |
| Preço de serviço (tabela) | pronto | pronto | `consultar_preco_tabela` |
| Área de atendimento | pendente | pendente | `buscar_conhecimento_institucional` |
| Como agendar | pendente | — | `buscar_conhecimento_institucional` |
| Como solicitar exame | — | pendente | `buscar_conhecimento_institucional` |
| Status de laudo | pendente | pendente | `consultar_status_laudo` |

As quatro pendências de conhecimento trazem o diagnóstico acionável esperado
("cadastre um documento na base com categoria começando por `institucional` ou
`atendimento` e com a fonte preenchida") — é exatamente o que o passo de
conteúdo institucional vai resolver. `status_laudo` aparece com
`depende_da_conversa=true`, por desenho: não há configuração prévia.

#### Falso verde confirmado em Endereço e Formas de contato

`*` Os quatro verdes marcados acima **não são confiáveis**. É a guarda 10 do
handoff, agora comprovada com dado real de stage e não só por leitura de código:

- `consultar_dados_institucionais`
  (`backend/app/services/whatsapp_bot_tools.py`) devolve `ok=True` sempre que
  existir uma linha de `Configuracao`, mesmo com **todos** os campos nulos —
  só devolve `ok=False` quando não há linha nenhuma.
- Inspeção somente leitura do formulário de Configurações em stage: `Endereço`,
  `Telefone`, `E-mail` e `Website` estão **vazios**; só `Cidade` (9 caracteres)
  e `Estado` (2) têm conteúdo.
- Logo o painel afirma que o bot "consegue responder" endereço e formas de
  contato quando não existe endereço nem telefone cadastrado.

Agravante para a RF-020: esse `ok=True` também conta como fonte válida no
`TurnoDeGeracao`, e o guardrail não ancora endereço nem telefone contra o
retorno da tool (ancora valor e horário). Um texto com endereço inventado
passaria como aprovado. Em `suggest` isso é revisado por humano; em `auto`
seria uma afirmação falsa enviada ao cliente.

#### Correção implementada (2026-08-23, após autorização explícita)

Três frentes, com o achado acima como caso de regressão:

1. **A tool falha fechado.** `consultar_dados_institucionais` devolve
   `ok=False` quando não há endereço nem contato publicável, com
   `campos_vazios` e mensagem apontando `Configurações > Empresa`. Passou a
   devolver `tem_endereco` e `tem_contato`, porque uma única tool sustenta
   duas intents. Cidade e estado não contam como endereço, e espaço em branco
   não conta como dado.
2. **A prontidão decide por intent.** `_CAMPO_EXIGIDO_POR_INTENT` liga
   `endereco` a `tem_endereco` e `formas_contato` a `tem_contato`. Com
   telefone preenchido e endereço vazio, o painel agora mostra contato verde e
   endereço pendente — antes mostrava os dois verdes.
3. **O guardrail ancora contato e endereço.** Dois motivos novos:
   `contato_fora_da_fonte` (telefone ou CEP que não veio da tool, comparado
   pela cauda dos dígitos para `+55`/DDD não gerarem falso bloqueio) e
   `endereco_sem_fonte` (resposta cita logradouro e o cadastro não tem
   endereço algum).

Limite declarado: **não** se tenta conferir prosa de endereço contra o
cadastro. Quando a fonte tem endereço, o texto passa sem comparação palavra a
palavra — texto livre não suporta isso de forma confiável. O que fica fechado é
afirmar endereço sem ter dado, que era o caminho real medido em stage.

Evidência:

| Item | Evidência |
| --- | --- |
| Tool falha fechado | `test_whatsapp_bot_tools.test_cadastro_institucional_vazio_falha_fechado` (só cidade/estado → `ok=False`, `campos_vazios` = email/endereco/telefone) |
| Separação por campo | `test_cadastro_..._so_telefone_preenchido_habilita_contato_e_nao_endereco` |
| Espaço em branco | `test_espaco_em_branco_nao_conta_como_dado` |
| Painel deixa de dar falso verde | `test_whatsapp_bot_painel.test_prontidao_nao_da_verde_com_cadastro_institucional_vazio` (as duas personas, `endereco` e `formas_contato`) |
| Painel separa as duas intents | `test_prontidao_separa_endereco_de_formas_de_contato` |
| Ancoragem de contato e endereço | 6 casos novos em `evals/whatsapp_bot_cases.json` (33 no total): telefone inventado, telefone da fonte com `+55`, CEP inventado, logradouro sem cadastro, logradouro com cadastro, contato sem número |
| Contrato dos motivos | `test_whatsapp_bot_evals.test_cobertura_de_todos_os_motivos_de_bloqueio` obriga caso de regressão para cada `MotivoBloqueio`; foi ele que reprovou a primeira versão desta correção, antes dos casos existirem |

Suíte focada do bot **164/164** (era 159).

#### Confirmação em stage depois de publicar

Publicado em `992b07e6` (Deploy run `32672704495`, Migration CI run
`32672704470`, ambos `success`). `GET /whatsapp/bot/prontidao` refeito no mesmo
ambiente onde o falso verde tinha sido medido:

| | Antes da correção | Depois |
| --- | --- | --- |
| Resumo | 8 prontos / 6 pendentes | **4 prontos / 10 pendentes** |
| `endereco` (as duas personas) | pronto (falso) | pendente, "Preencha endereco, telefone e e-mail em Configuracoes > Empresa" |
| `formas_contato` (as duas personas) | pronto (falso) | pendente, mesmo diagnóstico |
| `horario_funcionamento`, `preco_servico` | pronto | pronto (inalterado, com dado real) |

Os quatro verdes que sobraram são os que têm dado por trás. O cadastro de stage
segue vazio de propósito até o usuário preenchê-lo — a mudança aqui é o painel
passar a dizer a verdade sobre isso.

Nota: com o cadastro **inteiramente** vazio o diagnóstico exibido vem do
`error` da tool, que lista os três campos de uma vez. A mensagem por campo
(`FALTA_CAMPO_INSTITUCIONAL`) aparece no caso parcial — telefone preenchido e
endereço vazio —, coberto por
`test_prontidao_separa_endereco_de_formas_de_contato`.

#### O caso parcial aconteceu no ambiente real

Logo depois, o usuário preencheu `Telefone`, `E-mail` e `Website` em
Configurações > Empresa e deixou `Endereço` vazio — sem combinar, produzindo o
caso parcial que até então só existia em teste unitário. Resultado em stage:

| | Valor |
| --- | --- |
| Resumo | **6 prontos / 8 pendentes** (era 4/10) |
| `formas_contato` (as duas personas) | **pronto**, com telefone e e-mail reais |
| `endereco` (as duas personas) | pendente, "Endereco vazio em Configuracoes > Empresa. Cidade e estado nao bastam" |

É a separação por intent funcionando fora do teste: mesma tool, mesmo `ok=True`,
vereditos diferentes. Antes desta correção o mesmo cadastro pintaria as duas de
verde. Confirmado também que o banco reflete o formulário (`endereco` com
comprimento `0` em ambos), então não foi falha de salvamento.

#### Fechamento: cadastro completo, prontidão honesta

Com `Endereço` preenchido (51 caracteres, **com CEP**), a prontidão em stage
fechou em **8 prontos / 6 pendentes**:

| Intent | Tutor | Clínica |
| --- | --- | --- |
| `horario_funcionamento` | pronto | pronto |
| `endereco` | pronto | pronto |
| `formas_contato` | pronto | pronto |
| `preco_servico` | pronto | pronto |
| `area_atendimento` | pendente (base) | pendente (base) |
| `como_agendar` / `como_solicitar_exame` | pendente (base) | pendente (base) |
| `status_laudo` | depende da conversa | depende da conversa |

Os oito verdes agora têm dado real por trás — coincidem em número com os oito
de antes da correção, mas quatro daqueles eram falsos. A sequência completa
ficou registrada acima: 8 (com 4 falsos) → 4 → 6 (parcial) → 8 verdadeiros.

Efeito colateral relevante: como o endereço cadastrado **contém CEP**, a âncora
`ceps_permitidos` do guardrail passa a ser alimentada com dado real em stage, e
não só nos evals. Um CEP diferente do cadastrado numa resposta agora cai em
`contato_fora_da_fonte`.

As seis pendências restantes são todas esperadas: quatro dependem do conteúdo
institucional (export das conversas, ainda não recebido) e duas dependem de
conversa real com exame, por desenho.

### Pendente na Fase 6

- P6.3: tráfego real em `suggest` **em produção**, com os números coletados e
  transcritos nesta seção. Mínimo de 20 rascunhos decididos por persona; hoje
  stage tem 1 no total.
- P6.4: decisão de `auto` registrada com número, após autorização explícita.
- Teste real de `consultar_status_laudo` em stage, sem conteúdo clínico na
  mensagem e sem envio automático.
- Conteúdo institucional sem PII cadastrado, para fechar as quatro pendências
  de conhecimento da prontidão.
- As **outras nove guardas** do handoff, antes de qualquer envio automático. A
  guarda 10 (falso verde de `consultar_dados_institucionais`) foi corrigida em
  2026-08-23; as nove restantes seguem sem implementação.
- ~~Preencher `Endereço`, `Telefone` e `E-mail` em Configurações > Empresa no
  stage.~~ **Feito pelo usuário em 2026-08-23**; a prontidão fechou em 8
  prontos / 6 pendentes, todos os verdes com dado real.

## Silêncio visível e pausa do envio assistido - 2026-08-25

Nasceu de um caso real: o dono clicou Enviar num rascunho, isso pausou a
conversa por 12h, e as **quatro** mensagens seguintes dele viraram
`suppressed/pausado`. Nada apareceu na central e ele concluiu que o bot estava
quebrado. O bot estava correto - o silêncio é que era invisível.

### O achado que mudou o desenho

`suppressed` não era apenas invisível: por a regra de `ultima_recusa` ser "a
ÚLTIMA linha da conversa", uma supressão posterior **apagava** o aviso de
`blocked`/`handoff` anterior, deixando a central em branco. Derivar o silêncio
da mesma linha `ultima` conserta os dois problemas de uma vez - e sem query
nova, porque a linha já está carregada.

### Visibilidade (RF-034)

`_estado_payload` ganhou `ultimo_silencio`, com allowlist `_SUPRESSOES_VISIVEIS`
= `pausado`, `janela_fechada`, `teto_diario`, `conversa_divergente`. Deixados de
fora de propósito: `bot_desabilitado` (apareceria em toda conversa com o kill
switch desligado), `modo_off` (redundante com `modo`, no mesmo payload),
`sem_pergunta` (cortesia da RF-P11 - alertar inverteria a regra) e os de
participação (`fora_do_piloto`, `clinica_desabilitada`, que são configuração e
não linha do tempo). Alertar sobre operação normal treinaria o atendente a
ignorar a área, que é o mesmo problema invertido.

Na central, um terceiro tier visual (`fc-wa-bot-silencio`), tracejado e sem
botão nenhum: é informação, não tarefa. Para `pausado` o texto cita a hora
usando o `pausado_ate` que já vinha no payload.

### Pausa do envio assistido

`WHATSAPP_BOT_ASSISTED_SEND_PAUSE_HOURS=2`, e `pause_conversation` ganhou um
kwarg `horas` opcional - default `None` preserva os demais chamadores sem
tocá-los. Só `enviar_rascunho` passa a duração curta.

**Risco investigado e descartado**: suspeitou-se que o detector `from_me` do
worker re-estenderia a pausa para 12h logo depois, tornando a mudança
cosmética. Não acontece no fluxo normal - `last_agent_id` só é escrito por
`claimConversation` (o envio **não** reivindica a conversa), e o `from_me` da
última mensagem só é verdadeiro se o atendente respondeu dentro da janela de
debounce, que é o CB-009 e aí 12h é a semântica certa.

### Cobertura

Backend: 5 testes novos em `test_whatsapp_bot_endpoints.py` (supressão acionável
vira aviso; ruído não vira; `suppressed` nunca entra em `ultima_recusa`;
silêncio posterior não apaga a tela; rascunho novo supera o aviso) e 5 em
`test_whatsapp_bot_gates.py` (horas explícitas vencem o default; sem `horas` o
comportamento antigo é preservado; horas inválidas caem no default; helper
defensivo; e um que falha se os dois defaults se igualarem, porque aí a
separação teria perdido o sentido).

Frontend: 2 testes em `page.test.tsx`, com o roteador de fetch que mocka a rota
de estado do bot. **Verificados por mutação**: desligar a renderização do aviso
derruba o teste, e restaurar o revive - a cobertura não é vazia.

Os dois literais de "12h" do frontend saíram: o toast passa a citar o
`pausado_ate` devolvido pelo PATCH, e o botão diz apenas "Pausar bot".

Suítes: backend **1098/1098**; frontend **100/100** em 15 arquivos; `eslint`,
`tsc --noEmit` e `next build` limpos.

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
- O falso verde do painel e a falta de ancoragem de contato/endereço foram
  **corrigidos em 2026-08-23** (guarda 10 das dez do handoff). O que resta do
  risco: a ancoragem de endereço impede afirmar logradouro sem dado, mas não
  compara prosa contra o cadastro — com endereço cadastrado, um número ou
  complemento errado ainda passaria. Em `suggest` um humano revisa; antes do
  `auto`, vale um caso de teste real com endereço preenchido.
- As **outras nove guardas** do handoff continuam abertas e nenhuma delas está
  implementada. Envio automático sem tratá-las reenviaria ao cliente no retry,
  faria o bot ver a própria mensagem e transformaria `sent` em duas coisas
  diferentes, contaminando justamente o número que autoriza o `auto`.

## Itens fora de escopo entregues

- Nenhum até o momento.

## Decisão de release

- [x] Aprovado para stage em `suggest` para continuidade da Fase 5.
- [ ] Aprovado para produção em modo `suggest`.
- [ ] Aprovado para produção em modo `auto` (allowlist da RF-019).
- [ ] Não aprovado (descrever motivo).

### Guarda 4 corrigida: a "ultima mensagem" era a errada (2026-08-24)

Segunda das dez guardas do handoff, e a unica delas que **ja mordia em
`suggest`** — nao era risco do envio automatico, era defeito em producao de
comportamento.

#### O defeito

`_fetch_last_message` pedia `page=1&limit=200` e usava `rows[-1]`.
`GET /conversations/:id/messages` ordena `created_at ASC, id ASC` com
`LIMIT/OFFSET` (`conversationsController.ts:289`) e **nao aceita parametro de
ordem**. Logo, em conversa com mais de 200 mensagens, `rows[-1]` e a **200a mais
antiga**, tratada como se fosse a ultima.

E nao ficava restrito a reconciliacao: `_process_job` usava a mesma funcao, e
`corpo = last_message.get("body")` e **a mensagem que o bot responde**. Numa
conversa longa o bot classificaria emergencia (RF-023), pedido de humano
(RF-011), pausa por `from_me` (RF-010) e tipo de mensagem (RF-013) em cima do
texto errado, e geraria rascunho para uma mensagem antiga. Degradava em silencio
exatamente nas conversas com mais historico.

#### A correcao

Duas frentes, nenhuma tocando o servico Node:

1. **`_process_job` deixou de fazer a segunda chamada.** A ultima mensagem ja
   vem no payload da conversa que ele **ja buscava**: `last_message_body`,
   `last_message_from_me`, `last_message_type` e `last_message_at`, montados por
   `LATERAL ... ORDER BY created_at DESC, id DESC LIMIT 1`
   (`conversationsController.ts:128`). Ordem correta por construcao, e **uma
   chamada HTTP a menos por job**. `last_message_at` e o discriminador de
   "existe mensagem", porque `body` pode ser vazio de forma legitima (imagem sem
   legenda).
2. **`_fetch_last_message` pagina ate o fim.** A reconciliacao ainda precisa
   dela, porque so o endpoint de mensagens traz `wa_message_id`. Como a resposta
   inclui `pagination.total`, com `limit=1` a ultima pagina e exatamente
   `total`: duas requisicoes minusculas em vez de uma trazendo 200 linhas — e,
   ao contrario da anterior, devolvendo a mensagem certa.

Alternativa descartada: adicionar `order=desc` ao endpoint do Node. Seria uma
API melhor, mas mexeria num servico recem-estabilizado depois do incidente de
producao, com contrato e testes proprios. A correcao ficou toda em Python.

#### Achado adicional: conversa divergente

`_process_job` busca a conversa **por telefone** e nunca conferia se era a mesma
do job. Se o Node devolver outra conversa para o mesmo telefone, o claim, a
janela e a ultima mensagem lidos sao de outra conversa. Agora isso termina em
`suppressed`/`conversa_divergente`, sem responder e sem retry — o proximo job
reavalia do zero.

#### Evidencia

| Item | Evidencia |
| --- | --- |
| Ultima pagina na reconciliacao | `test_whatsapp_bot_worker_service.test_reconciliation_pega_a_ultima_pagina_em_conversa_longa` — conversa com 350 mensagens, isca antiga na pagina 1; asserta que a ultima chamada pede `page=350` e que o job enfileirado e o da mensagem recente |
| Uma chamada so no `_process_job` | `test_whatsapp_bot_process_job` — o harness passou a devolver **uma** resposta HTTP, e `get_mock.call_count` caiu de 2 para 1 |
| Conversa divergente | `test_whatsapp_bot_process_job.test_conversa_divergente_suprime_sem_responder` — `suppressed`/`conversa_divergente`, sem PATCH e sem push |

Os dois testes novos foram **verificados por mutacao**: com a implementacao
antiga restaurada, ambos falham; com a nova, passam. Sem isso seriam teatro.

Suite focada do bot **166/166** (era 164).

#### Guardas restantes

Fechadas: a 10 (falso verde da prontidao), a 4 (esta) e a 6 (bloqueio
invisivel na central). Seguem abertas as outras sete: 1, 2, 3, 5, 7, 8 e 9. Todas sao especificas do envio
automatico, exceto a 6 (`blocked` e `handoff` invisiveis na central), que ja
limita a utilidade do `suggest` hoje.

### Guarda 6 corrigida: bloqueio e handoff invisiveis na central (2026-08-24)

Terceira guarda fechada, e a segunda que **ja limitava o `suggest`** — nao era
so risco do envio automatico.

#### O defeito

`_estado_payload` so consultava respostas com `decisao == "draft"`. Quando o bot
terminava em `blocked` (guardrail recusou o texto) ou `handoff` (emergencia,
pedido de humano, identidade nao resolvida), a central nao mostrava **nada**: o
atendente via uma conversa sem rascunho, indistinguivel de uma conversa em que o
bot nunca rodou. A RF-022 diz que bloqueio nunca vira silencio, e virava.

#### A correcao

`GET /conversas/{wa_identity}/estado` passa a devolver `ultima_recusa` com
`decisao`, `motivo` e `criado_em`. A central mostra um aviso proprio, em cor de
alerta, **sem Enviar e sem Editar**.

Duas decisoes de desenho que mudam o que a tela pode fazer:

1. **O texto recusado nao vem no payload.** Em `blocked` ele e exatamente o que
   o guardrail barrou. Devolve-lo poria a frase proibida a um copiar-colar de ir
   ao cliente, e uma mudanca futura de UI poderia acidentalmente renderiza-la
   com um botao de envio ao lado. O atendente precisa saber QUE o bot recusou e
   POR QUE, nao receber a frase de volta. O teste asserta a ausencia do texto no
   payload inteiro, nao so no campo.
2. **Olhamos a ULTIMA resposta, nao "a ultima recusa".** Se a consulta fosse
   pela mais recente com `decisao IN (blocked, handoff)`, um bloqueio velho
   ficaria pendurado na tela para sempre, mesmo depois de o bot ter respondido
   bem na mensagem seguinte.

`suppressed` **nao** vira aviso: `bot_desabilitado`, `pausado` e `teto_diario`
sao operacao normal, e virariam ruido permanente.

No frontend, `BOT_RECUSA_MOTIVOS` traduz o motivo do guardrail para portugues de
atendente ("a resposta continha diagnostico"), com fallback para o motivo bruto
— sumir com a informacao seria pior que mostra-la crua.

#### Divergencia registrada com a RF-022

O texto da RF-022 diz que o bloqueio "vira rascunho com o motivo registrado".
Aqui ele vira **aviso** com o motivo registrado, sem o texto. A intencao da
regra — a equipe fica sabendo — esta cumprida; a letra, nao. Tratar conteudo
clinico recusado como rascunho editavel o colocaria a um clique do cliente, que
e o oposto do que o proprio guardrail existe para impedir. A spec foi atualizada
para descrever o comportamento implementado.

#### Evidencia

| Item | Evidencia |
| --- | --- |
| Bloqueio aparece, com motivo | `test_whatsapp_bot_endpoints.test_get_estado_expoe_bloqueio_com_motivo_e_sem_o_texto_recusado` |
| Texto recusado NAO vaza | mesmo teste: `assertNotIn("cardiomiopatia", json.dumps(resposta))` — asserta o payload inteiro |
| Handoff aparece | `test_get_estado_expoe_handoff` (`emergencia`) |
| Bloqueio velho nao ressuscita | `test_bloqueio_superado_por_rascunho_novo_nao_reaparece` |
| `suppressed` nao vira ruido | `test_suppressed_nao_vira_aviso_na_central` |

Verificado por **mutacao** nas duas direcoes: escondendo tudo (comportamento
antigo) o teste falha; incluindo `texto_gerado` no payload o teste tambem falha.
A assercao de seguranca tem dente.

Backend **1036/1036** (era 1032); frontend **98/98**, `eslint` sem warning,
`tsc --noEmit` limpo, `next build` concluido.

#### Verificacao visual em stage (2026-08-24)

Publicado em `9f6f8ca4` (Deploy run `32681036719`, Migration CI `32681036732`,
ambos `success`).

Tentei primeiro com dado real e **nao existe dado real para isso em stage**.
As 19 respostas `handoff` (todas `identidade_nao_resolvida`, nenhum `blocked`)
vieram de smokes sinteticos: `wa_identity` e `conversation_id` fabricados, que
nunca existiram como conversa no inbox do Node. Varri as 100 conversas mais
recentes das 418 do inbox, nas duas formas do nono digito, e nenhuma tem
`ultima_recusa` nem `rascunho_pendente`.

Entao verifiquei o que de fato faltava — a renderizacao — injetando a resposta
do endpoint **apenas na aba do navegador**, sem escrever nada no servidor. Com
`ultima_recusa = {decisao: "blocked", motivo: "diagnostico"}` a secao renderizou:

| Checado | Resultado |
| --- | --- |
| Secao presente | sim, `.fc-wa-bot-recusa` |
| Texto | "O BOT NAO RESPONDEU · a resposta continha diagnostico. Responda voce mesmo pelo campo abaixo. O texto que o bot chegou a montar nao e exibido nem enviavel." |
| **Botoes na secao** | **0** — a propriedade que importa |
| Cor / acessibilidade | fundo ambar, `aria-label="O bot nao respondeu"` |

O stub saiu com o reload; confirmado que nao ficou residuo na sessao.

O que **nao** foi verificado: a secao aparecendo a partir de uma recusa real
gravada pelo worker. Isso so acontece quando houver trafego real que produza
`blocked` ou `handoff` numa conversa existente — naturalmente coberto pela
observacao do P6.3.

### `preco_servico` sai da allowlist de `auto` (2026-08-24)

Decisao do usuario, tomada a partir do que o historico real do WhatsApp mostrou.

#### O que motivou

Exploracao dos ultimos 45 dias no WhatsApp Business da clinica (364 conversas;
metodo: busca pelos textos que as secretarias colam, sem ler tudo). As tabelas
de preco vivas sao tres, e mapeiam nas mesmas regioes que a tool ja conhece:

| Servico | Fortaleza | RM | Domiciliar |
| --- | --- | --- | --- |
| Consulta | 230,00 | 230,00 | 290,00 |
| Ecocardiograma | 180,00 | 200,00 | 290,00 |
| Eletrocardiograma | 120,00 | 150,00 | 175,00 |
| Pressao arterial | 40,00 | 60,00 | 60,00 |
| Combo Eco + Eletro | 250,00 | 300,00 | — |
| Drenagem de efusao | 280,00 | — | — |

Mas existe uma **quarta dimensao que o modelo de dados nao tem**: a faixa de
**plantao**, com precos proprios (Fortaleza: consulta 290, eco 230, eletro 170,
PA 60; RM: consulta 260, eco 230, eletro 160), valendo de segunda a sexta apos
18h, sabado apos 16h, e domingos e feriados das 9h as 18h.

`consultar_preco_tabela` le so `preco_*_comercial` e crava
`"tipo_horario": "comercial"`. Fora do expediente ela devolve o valor errado.

#### Por que isso e pior do que parece

O guardrail ancora valor no retorno **literal** da tool. Um preco desatualizado
ou de faixa errada **nao vira bloqueio**: vira resposta aprovada e ancorada. E o
unico caminho conhecido para o bot afirmar algo falso com todos os guardrails
satisfeitos.

E o bot roda 24/7 justamente para atender fora do expediente — exatamente a
faixa em que o plantao vale. O erro nao seria raro; seria concentrado onde o bot
mais atua sozinho.

O usuario tambem informou que **os valores da tabela de stage estao
desatualizados**, o que torna qualquer conferencia em stage inconclusiva para o
rollout. A conferencia que vale e contra producao, e segue pendente por falta de
sessao autenticada.

#### O que mudou no codigo

Duas listas onde havia uma:

- `INTENTS_ATENDIDAS_POR_PERSONA` — o que o bot sabe responder, e o que a
  prontidao sonda.
- `INTENTS_AUTO_POR_PERSONA` — derivada da primeira menos
  `INTENTS_BLOQUEADAS_NO_AUTO` (hoje so `preco_servico`).

A separacao existe por causa de um efeito colateral concreto: a prontidao
iterava a lista do `auto` para decidir o que sondar. Sem separar, tirar preco do
`auto` o apagaria do painel e o admin perderia a visibilidade de que a fonte de
preco esta sa — trocaria um risco por uma cegueira.

Em `suggest` nada muda: o texto continua **aprovado** (o valor veio da tool, e
seguro), so nao e mais `auto_elegivel`. Vira rascunho para revisao.

#### Evidencia

| Item | Evidencia |
| --- | --- |
| Preco fora do auto nas duas personas | `test_whatsapp_bot_guardrails.GuardrailPrecoForaDoAutoTest.test_preco_nao_e_auto_em_nenhuma_persona` |
| Aprovado, porem nao auto | `..._test_preco_ancorado_e_aprovado_mas_vira_rascunho` (`aprovado=True`, `auto_elegivel=False`, motivo `intent_fora_allowlist`) |
| As demais seguem auto | `..._test_as_demais_intents_seguem_auto` |
| Continua visivel no painel | `test_whatsapp_bot_painel.test_preco_servico_e_sondado_mas_nao_e_auto_elegivel` |
| Contrato dos evals | caso `valor-ancorado-na-tabela` atualizado para `auto_elegivel: false` |

Verificado por **mutacao** nas duas direcoes que importam: devolver
`preco_servico` ao `auto` derruba 4 testes; religar a prontidao na lista do
`auto` derruba o teste do painel.

Suite focada do bot **174/174** (era 170).

#### Pendencias que isto NAO resolve

1. **Conferir as tres tabelas contra `Servico` em producao.** Sem isso, nao se
   sabe se os valores comerciais estao corretos — e eles continuam sendo
   cotados em `suggest`.
2. **Modelar plantao.** Enquanto nao existir, `preco_servico` fica fora do
   `auto`. Exige coluna nova e a tool passar a considerar horario.
3. **Servicos possivelmente ausentes do cadastro**: "Combo Eco e Eletro" e
   "Drenagem de efusao" aparecem na tabela viva. Se nao existirem como
   `Servico` com preco > 0, a tool os descarta do payload e o bot simplesmente
   emudece sobre eles.


### Conferencia das tabelas de preco contra producao (2026-08-24)

Feita com a sessao autenticada de producao, somente leitura, via
`GET /api/v1/servicos`. 12 servicos ativos.

#### Correcao de uma afirmacao anterior minha

Eu havia registrado que **o modelo de dados nao representa plantao**. Estava
errado: `Servico` tem `fortaleza_plantao`, `rm_plantao` e `domiciliar_plantao`,
e elas estao populadas em producao. Inferi a ausencia do `_REGIAO_COLUNAS` de
`whatsapp_bot_tools.py`, que so mapeia `*_comercial`.

O problema e menor do que eu disse: **a tool ignora colunas que existem**. Nao
e modelar plantao, e usa-lo — mapear as tres colunas restantes e escolher a
faixa pelo horario da mensagem.

#### Resultado: 15 de 21 conferem

**Quatro divergencias de valor** — o cadastro discorda do que o atendimento
manda hoje:

| Servico / faixa | WhatsApp | Cadastro |
| --- | --- | --- |
| Eletrocardiograma / Fortaleza plantao | 170 | 150 |
| Eletrocardiograma / RM comercial | 150 | 140 |
| Pressao arterial / RM comercial | 60 | 40 |
| Consulta / RM plantao | 260 | 290 |

**Dois zerados** — `consultar_preco_tabela` descarta preco zero do payload,
entao o bot **emudece** em vez de errar:

- Eletrocardiograma / RM plantao (atendimento cobra 160)
- Pressao arterial / domiciliar (atendimento cobra 60)

**"Drenagem de efusao" nao existe como `Servico`**, embora apareca na tabela de
Fortaleza a R$ 280.

Tambem: `domiciliar_plantao` esta zerado nos 12 servicos, e "Retorno" esta
inteiramente zerado.

#### O que isso confirma

Se `preco_servico` ainda estivesse na allowlist de `auto`, o bot cotaria 140
onde o atendimento cobra 150 — e o guardrail **ancoraria como conferido**,
porque o numero veio da tool. A decisao de tirar preco do `auto`, tomada horas
antes por outro motivo (plantao), se mostrou certa por um motivo que ainda nao
se conhecia.

#### Pendente

1. Corrigir as quatro divergencias e os dois zerados no cadastro — decisao de
   negocio, nao de codigo: qual dos dois lados esta certo.
2. Cadastrar "Drenagem de efusao" ou parar de oferece-la na tabela do WhatsApp.
3. Mapear as colunas de plantao em `_REGIAO_COLUNAS` e escolher a faixa pelo
   horario. So depois disso `preco_servico` pode voltar ao `auto`.


### Conteudo institucional cadastrado e revisado (2026-08-24)

Extraido do historico real do WhatsApp (45 dias, 364 conversas), sem PII e sem
preco. Quatro documentos ativos em stage; prontidao em **12 prontos / 2
pendentes** — so `status_laudo`, que depende de conversa real e nao fecha por
cadastro.

| Documento | Publico | Categoria |
| --- | --- | --- |
| Area de atendimento e modalidades | ambos | `institucional` |
| Como agendar um atendimento | tutor | `institucional_tutor` |
| Como a clinica parceira solicita um exame | clinica | `institucional_clinica` |
| Exames cardiologicos antes de procedimento com anestesia | ambos | `institucional` |

#### O que NAO entrou, e por que

Preco, endereco, telefone e horario comercial vem de tools
(`consultar_preco_tabela`, `consultar_dados_institucionais`,
`consultar_horario_funcionamento`). Duplica-los na base criaria segunda fonte
de verdade que envelhece em silencio — e o guardrail ancora valor, telefone e
CEP no retorno **da tool**, entao o documento divergente seria rejeitado, nao
obedecido. So o **plantao** entrou (documento 1), e apenas o *quando*, porque
nenhuma tool representa essa faixa hoje.

#### Correcao aplicada por informacao do usuario

A primeira versao do documento da clinica dizia so "sao realizados apenas os
exames que constam na solicitacao". **Verdade pela metade**: a solicitacao e
**teto, nao obrigacao**. O cliente pode fazer so parte dos exames conosco — o
caso descrito pelo usuario (solicitacao de eco, eletro e PA, mas so o eco aqui
porque os outros ja foram feitos em outro lugar) e frequente. Do jeito
anterior, o bot poderia dar a entender que os tres seriam realizados.

Acrescentado tambem: a solicitacao e emitida pelo veterinario, tem **validade
de 30 dias**, e o cliente domiciliar envia foto ou PDF dela.

Descartado por decisao do usuario o texto sobre castracao em animais a partir
de 5 anos, encontrado no historico. A regra real e mais ampla e virou o quarto
documento: **eco e eletro sao exigidos antes de qualquer procedimento com
anestesia, independente de idade e de qual seja o procedimento**.

#### Duas decisoes de redacao

1. **O texto pede foto ou PDF mas nao promete le-lo.** Diz "a equipe confere o
   documento", nao "me envie que eu verifico". Quando a imagem chegar, por
   RF-013 vira handoff e uma pessoa assume — o comportamento correto. Prometer
   analise de anexo seria criar expectativa que o bot nao cumpre.
2. **Os termos que o cliente digita ficaram no texto** ("a domicilio", "atende
   na minha regiao", "agendar", "solicitacao de exame", "castracao",
   "cirurgia"). A busca tem piso por palavra-chave: documento escrito em
   linguagem interna fica correto e invisivel.

O quarto documento foi **verificado contra as quatro listas de bloqueio
clinico antes de ser escrito** (`diagnostico`, `dose_medicacao`, `prognostico`,
`avaliacao_sintoma`). Se algum termo casasse, o documento ficaria correto e a
intent inrespondivel — o bot bloquearia a propria resposta. E redigido como
**exigencia** ("sao exigidos antes de"), nao como conduta ("seu pet precisa
de"), que resvalaria em orientacao clinica.

#### Como a revisao foi aplicada

O projeto **nao edita documento**: arquiva e recria, coerente com
`conteudo_sha256` e auditoria. Os dois desatualizados foram arquivados via
`POST /assistente-ia/conhecimento/{id}/arquivar` (admin-only) e recriados.
Confirmado antes de agir que `search_knowledge` filtra `status == "active"`
(`assistente_ia_management.py:658`) — sem isso, cadastrar as versoes novas
deixaria **duas** respostas conflitantes na base, e a busca poderia devolver a
velha.

Estado final: 4 documentos visiveis, 0 ignorados.


## Promocao para producao: o bot chegou dormente (2026-08-24)

Primeira vez que o chatbot toca producao. `stage -> main` via
`scripts/promote_stage_to_main.sh`; `origin/main` foi de `1474902d` para
`087ccc9b`. Deploy to VPS run `32783092734` e Migration CI `32783092889`, ambos
`success` — com `quality-gate` e `sdd-guardrail` aprovados.

### O que foi verificado ANTES de promover

| Risco levantado | Verificacao |
| --- | --- |
| Bot subir ligado | Workflow de producao nao menciona `WHATSAPP_BOT`; default de `config.py` e `False`; a migracao faz `UPDATE` explicito do toggle para `false` |
| Promocao desfazer o hotfix do deploy | `CLAUDE.md` avisa que a promocao resolve conflito em favor de `stage` e pode desfazer hotfix sem avisar. Conferido: `stage` **nao tem** a linha ruim e **tem** o step do `test_whatsapp_stage_meta_isolation.sh`, que asserta a mesma coisa |
| Perder CSS que so existia em producao | As tres classes `fc-wa-envio-badge*` ja existiam em `stage` |
| Alterar o caminho de envio de producao | Resolvido antes, tornando o nono digito opt-in e desligado em producao |

Dois conflitos de merge (`deploy.yml`, `globals.css`), ambos resolviveis em
favor de `stage` sem perda — verificado arquivo a arquivo antes de rodar.

### O que foi verificado DEPOIS

| Item | Resultado |
| --- | --- |
| `WHATSAPP_META_SOURCE_ENV_FILE` em `main` | ausente — hotfix preservado |
| `WHATSAPP_GRAPH_FORCE_BR_MOBILE_NINTH_DIGIT` no deploy de producao | ausente — envio inalterado |
| `fc-wa-envio-badge*` em `main` | 3 classes presentes |
| Arquivos `whatsapp_bot` em `main` | 42 |
| `whatsapp_bot_enabled_env` | **false** |
| `whatsapp_bot_atendimento_habilitado` | **false** |
| `whatsapp_bot_ativo` | **false** |
| `jobs_por_status` / `respostas_por_decisao` | `{}` / `{}` |
| Producao HTTP | `200` / `200` / `401` |
| Stage | inalterado |

O endpoint de preview responde `200`: o codigo esta la e funcional, apenas
inerte.

### Producao virada para `piloto`

A migracao cria `whatsapp_bot_participacao = 'todos'` — correto como default,
porque preserva comportamento em quem ja usava. Mas em **producao**, onde o bot
nunca rodou, `todos` significa que o primeiro clique no toggle exporia **todos
os tutores e todas as clinicas de uma vez**, que e exatamente o que o piloto foi
construido para evitar.

Virado para `piloto` logo apos a promocao:

| | |
| --- | --- |
| `whatsapp_bot_participacao` | `todos` -> **`piloto`** |
| Clinicas ativas em producao | **161** |
| Clinicas que participam | **0** |
| Clinicas com marcacao | **0** |
| Toggle institucional | continua **false** |

Duas travas independentes: mesmo que alguem ligue o toggle, ninguem e atendido
ate ser habilitado clinica por clinica.

### O que falta antes de ligar

1. **Corrigir o cadastro de preco em producao** — quatro divergencias e dois
   zerados. Com `preco_servico` fora do `auto` nada sai errado ao cliente, mas
   os rascunhos trariam valor desatualizado, e a taxa de aceite mediria a
   qualidade de uma resposta errada.
2. Habilitar as clinicas do piloto.
3. So entao ligar o toggle institucional em `suggest`, e comecar o P6.3 com a
   metrica quebrada por clinica.


## Preco: producao e a fonte de verdade (2026-08-24)

Decisao do usuario, e ela **inverte** o enquadramento que eu tinha dado a
conferencia. Eu havia registrado quatro "divergencias a decidir, qual lado esta
certo". Nao ha o que decidir: **producao esta correta**, e as tabelas que o
atendimento cola no WhatsApp sao provavelmente de uma tabela antiga.

| Servico / faixa | Mandam no WhatsApp | Correto (producao) |
| --- | --- | --- |
| Eletrocardiograma / Fortaleza plantao | 170 | **150** |
| Eletrocardiograma / RM comercial | 150 | **140** |
| Pressao arterial / RM comercial | 60 | **40** |
| Consulta / RM plantao | 260 | **290** |

Em tres dos quatro casos o atendimento cobra **a mais** do que a tabela. E
achado operacional, fora do escopo desta spec — mas com consequencia direta
aqui: quando o bot ligar, vai cotar o valor correto e passar a **divergir do que
a equipe fala**. O cliente receberia dois precos. Vale alinhar a equipe antes de
ligar o piloto.

Os dois "zerados" tambem deixam de ser problema: se producao e a verdade, entao
Eletrocardiograma / RM plantao e Pressao arterial / domiciliar realmente nao tem
preco naquelas faixas, e o bot **emudecer** e o comportamento correto.

### Correcao nos documentos: drenagem de efusao

Eu havia listado "drenagem de efusao" como exame disponivel nos documentos 1 e
3, tirando da tabela do WhatsApp. Ela **nao existe como `Servico`**. Aplicando o
mesmo principio — producao e a verdade —, saiu dos dois documentos.

E tambem a direcao segura: mantida, o bot anunciaria um exame que
`consultar_preco_tabela` nao sabe cotar, e a pergunta seguinte do cliente
("quanto custa?") cairia sem fonte. Removida, o bot apenas nao menciona.

Aplicado em **producao** por arquivar-e-recriar (o projeto nao edita documento).
Estado: 4 visiveis, 3 ignorados — os ignorados sao internos ("Protocolo seguro
de rascunhos clinicos", "Rotina administrativa da Mente FortCordis"), e a
allowlist de categoria os mantem invisiveis para o bot que fala com cliente.

**Pendente**: aplicar a mesma remocao nos documentos de **stage**, cuja sessao
caiu no meio da tarefa e nao voltou. Ate la, stage e producao divergem nesse
ponto — stage ainda anuncia drenagem de efusao. Nao afeta cliente: stage so fala
com destinatarios pre-verificados do numero de teste da Meta.

## Conteudo institucional em producao (2026-08-24)

Os quatro documentos foram cadastrados em producao depois da promocao. A
prontidao de producao ficou em **8 prontos / 6 pendentes**:

| Intent | Estado |
| --- | --- |
| `horario_funcionamento`, `preco_servico` | pronto |
| `area_atendimento`, `como_agendar`, `como_solicitar_exame` | **pronto** — os documentos foram encontrados |
| `endereco`, `formas_contato` | **pendente** — cadastro da empresa vazio |
| `status_laudo` | depende da conversa |

### A guarda 10 provou seu valor em producao

`endereco` e `formas_contato` estao pendentes porque `Configuracao` de producao
tem `nome_empresa`, `cidade` e `estado`, mas **`endereco`, `telefone`, `email` e
`website` vazios** — exatamente o estado que stage tinha de manha.

Sem a correcao da guarda 10, feita horas antes, producao estaria mostrando
**verde** nessas duas intents com o cadastro vazio, e o bot poderia afirmar
endereco e telefone sem ter nenhum. A correcao pegou o caso real no ambiente que
importa, sem ter sido procurada.

O bot segue **dormente** em producao: `bot_ativo: false`.

### Fechamento: producao em 12/2

O usuario preencheu `endereco`, `telefone`, `email` e `website` em
Configuracoes > Empresa de producao. A prontidao fechou:

| | Antes | Depois |
| --- | --- | --- |
| Resumo | 8 prontos / 6 pendentes | **12 prontos / 2 pendentes** |
| `endereco`, `formas_contato` | pendentes, cadastro vazio | **prontos, por dado real** |
| `status_laudo` | pendente | pendente — depende de conversa, por desenho |

Producao tem agora a mesma prontidao de stage, com o bot ainda **dormente** e a
participacao em `piloto`.

Drenagem de efusao confirmada fora dos documentos por decisao do usuario.

## RF-P12 / RF-P13 — vocabulario de servico e frase de preco (2026-08-25)

### O defeito, medido no catalogo de producao

O usuario perguntou ao bot "gostaria de saber o valor do eco" e recebeu:

> Atendimento automático da FortCordis: valores de tabela - Consulta + Eco:
> R$ 410,00; Consulta + Eco + Eletro: R$ 480,00; Eco + Eletro: R$ 250,00.

O catalogo de producao tem **`Ecocardiograma` avulso por R$ 180,00**. Ele nao
foi citado. Nao era so verbosidade: a resposta cotava **2,3x o preco real** do
que foi perguntado.

Causa: `alvo in nome` (substring pura) casava seis servicos; a ordem era
`Servico.nome.asc()`; o corte era `[:3]`. Em ordem alfabetica `Ecocardiograma`
e o **sexto**, atras de tres combinacoes mais caras.

### Antes e depois, mesmo catalogo

| Pergunta | Antes | Depois |
| --- | --- | --- |
| "eco" | Consulta + Eco R$ 410; Consulta + Eco + Eletro R$ 480; Eco + Eletro R$ 250 | **Ecocardiograma custa R$ 180,00.** |
| "ecodopplercardiograma" | nenhum servico casava (substring falhava) | Ecocardiograma custa R$ 180,00. |
| "ultrassom do coração" | nenhum servico casava | Ecocardiograma custa R$ 180,00. |
| "ECG" | nenhum servico casava | Eletrocardiograma custa R$ 120,00. |
| "consulta com eco" | Consulta R$ 230; Consulta + Eco R$ 410; Consulta + Eco + Eletro R$ 480 | Consulta + Eco custa R$ 410,00. |
| "eco e eletro" | tres combinacoes | Eco + Eletro custa R$ 250,00. |
| generica, sem servico | Consulta; Consulta + Eco; Consulta + Eco + Eletro (alfabetica) | Consulta R$ 230; Ecocardiograma R$ 180; Eletrocardiograma R$ 120 |

Os quatro sinonimos que "nao casavam antes" nao produziam resposta errada —
produziam `ok: False`, e a intent caia sem fonte. Passaram a responder.

### Testes e verificacao por mutacao

`backend/tests/test_whatsapp_bot_servico_match.py`: 12 testes, 26 subtestes.
O catalogo usado e o de producao copiado literalmente — o defeito depende
desses nomes para reproduzir.

Nao basta os testes passarem; foi verificado que eles **falham** quando a
correcao e desfeita:

| Mutacao aplicada | Resultado |
| --- | --- |
| ordenacao volta a ser alfabetica | **3 falhas** (`regressao_eco_avulso...`, `combinacao_pedida_ganha...`, `empate_prefere_o_servico_mais_simples`) |
| fronteira de palavra vira substring pura | **1 falha** (`fronteira_de_palavra_impede_falso_positivo_em_preco`) |
| codigo restaurado | 12 passam |

A fronteira de palavra e o que impede "qual o **preço** da consulta" de virar
pedido de ecocardiograma (`preco` contem `eco` depois de remover acento) e
"é **para** o meu cachorro" de virar pedido de pressao arterial.

Suite completa do bot apos a mudanca: **289 passaram, 2 skipped, 222
subtestes**.

### O buraco do guardrail, registrado de proposito

Caso de eval novo `valor-certo-no-servico-errado-passa-no-guardrail`: o texto
"O ecocardiograma custa R$ 410,00" com `valores_permitidos` contendo `410.00`
e **APROVADO** pelo guardrail. R$ 410 e o preco de `Consulta + Eco`.

O guardrail confere a procedencia do numero, nao o servico a que ele pertence.
Por isso a frase de preco sai de `_corpo_de_preco`, montada do payload, e nao
da redacao do modelo. O caso fica no arquivo como alerta permanente: se algum
dia a redacao livre voltar para `preco_servico`, nada abaixo dele protege.

### Fora de escopo desta entrega

O vocabulario cobre os quatro procedimentos do catalogo atual (eco, eletro,
pressao arterial, consulta). Servico novo exige entrada nova em
`whatsapp_bot_servico_sinonimos.json` — ate la, cai na rede de substring.
Nao ha teste que detecte servico cadastrado sem vocabulario correspondente.

## RF-P14 — regiao de preco vem do cadastro (2026-08-25)

### O defeito

Martiniano perguntou se o bot distingue clinica de Fortaleza de clinica de
regiao metropolitana. Nao distinguia.

`regiao` era parametro preenchido pelo **modelo**, com descricao
`"fortaleza | rm | domiciliar"`. O prompt da persona clinica
(`_PERSONA_CLINICA`) nao informa cidade nem regiao — o modelo nao tinha dado
nenhum para decidir, e `_normalizar(regiao) or "fortaleza"` transformava o
silencio dele em Fortaleza.

### Tamanho do erro, medido em producao

| Servico | Fortaleza | RM | Diferenca |
| --- | ---: | ---: | ---: |
| Ecocardiograma | 180,00 | 200,00 | +20,00 |
| Eletrocardiograma | 120,00 | 140,00 | +20,00 |
| Eco + Eletro | 250,00 | 300,00 | **+50,00** |
| Eco + Eletro + PA | 290,00 | 340,00 | **+50,00** |
| Consulta + Eletro | 300,00 | **0,00** | SEM RM |

Todo preco RM e igual ou maior. O bot cotava **abaixo** da tabela correta —
erro a favor do cliente e contra a FortCordis, e divergente da fatura.

**Exposicao:** 1 das 10 clinicas ativas no piloto. `Pet Sanus Caucaia`,
`tabela_preco_id = 2`. As outras 9 estao na tabela 1, onde o default acertava
por coincidencia.

### A regra ja existia

`_preco_tabela_padrao` (`precos_service`) resolve por `Clinica.tabela_preco_id`:
`1` Fortaleza, `2` RM, `3` Domiciliar, qualquer outro → `PrecoServico`
customizado. E o que a fatura usa. O bot ignorava.

Nao foi criado criterio novo. Inferir por `Clinica.cidade` (string livre) teria
sido pior: o bot cotaria por um criterio e o financeiro faturaria por outro.

### Comportamento depois, contra o catalogo de producao

| Pergunta | Vet Plus (tabela 1) | Pet Sanus Caucaia (tabela 2) | Aracati (tabela 4) |
| --- | --- | --- | --- |
| "eco" | Ecocardiograma custa R$ 180,00 (tabela Clinicas Fortaleza). | Ecocardiograma custa R$ 200,00 (tabela Regiao Metropolitana). | sem resposta: `tabela_personalizada` |
| "consulta com eletro" | R$ 300,00 (tabela Clinicas Fortaleza). | sem resposta: `sem_preco_na_regiao` | sem resposta: `tabela_personalizada` |
| "eco e eletro" | R$ 250,00 | R$ 300,00 | sem resposta |
| tabela geral | Consulta 230; Eco 180; Eletro 120 | Consulta 230; Eco 200; Eletro 140 | sem resposta |

### Decisoes que valem registrar

**Tabela personalizada nao e cotada.** Tabela fora de `{1,2,3}` e preco
negociado, fora da allowlist da RF-019. Falha fechado. Escolher a coluna 1/2/3
e dimensao publica da tabela; o negociado continua inalcancavel. As duas coisas
sao separaveis — so a segunda motivava `consultar_preco_tabela` a ignorar a
clinica.

**Servico sem preco na regiao falha fechado quando e o servico pedido.**
Descobriu-se por teste que a checagem generica `if not itens` vinha ANTES do
diagnostico especifico e o mascarava; a ordem foi invertida.

**A etiqueta cobre Fortaleza tambem.** Etiquetar so RM nao pegaria o erro
inverso — clinica de RM cadastrada como Fortaleza. Com a etiqueta em toda
resposta de persona clinica, quem revisa o rascunho ve a base da cotacao.

**Escopo sintetico nao quebra a sonda.** `clinica_id=0` (prontidao e simulacao)
nao casa cadastro. A primeira versao tratava isso como falha dura e derrubou
`test_preco_servico_e_sondado_mas_nao_e_auto_elegivel` — artefato de
diagnostico virando falha de produto. Passou a cair na tabela padrao **sem
etiqueta**, espelhando `tabela_preco_id or 1` da fatura.

### Testes

6 testes novos em `test_whatsapp_bot_tools.py` + 3 em
`test_whatsapp_bot_servico_match.py`. Suite do WhatsApp: **298 passaram, 2
skipped, 226 subtestes**.

Verificacao por mutacao da guarda de deriva: trocar `2: "rm"` por
`2: "domiciliar"` no mapa do bot ⇒ **3 falhas**, incluindo
`test_mapa_de_tabela_do_bot_nao_diverge_da_fatura`, que compara o mapa
duplicado contra `_preco_tabela_padrao` real.

A fixture de `test_whatsapp_bot_painel.py` nao criava `Clinica.__table__` —
lacuna real do teste, corrigida.

### Pendencias que dependem de decisao de negocio

1. **`Consulta + Eletro` sem preco RM**: cadastro faltando ou combo nao
   oferecido em RM? Hoje o bot faz handoff nos dois casos, que e seguro mas
   nao explica. Perguntado a Martiniano, sem resposta ate o fim desta sessao.
2. **Tutor**: nao tem `tabela_preco_id`; segue em Fortaleza por default, como
   antes. Se existir tutor de RM, a cotacao dele esta errada pelo mesmo motivo
   que a da clinica estava. Tambem perguntado, sem resposta.

## RF-P15 — tutor nunca recebe a tabela praticada com clinica (2026-08-26)

### De onde veio

Martiniano descreveu o fluxo real da secretaria: tutor pergunta valor, ela
pergunta se e **domiciliar ou em clinica**. Se for em clinica, **nao passa
tabela** — orienta o tutor a procurar a clinica de preferencia dele, que define
preco e agenda.

O bot fazia o oposto. Persona tutor caia em `regiao="fortaleza"`, que e a
tabela `1` — `Clinicas Fortaleza`, preco **B2B** que a clinica parceira
remarca. O bot cotaria R$ 180,00 (atacado) ao consumidor final, subcotando a
propria clinica contra ela mesma.

### Nao estava vazando — era mina, nao incendio

```python
# CA-P02/CA-P06: em piloto, ausencia de habilitacao explicita e `off` -
# inclusive para tutor, que nao tem agrupamento equivalente.
if resolve_participacao(db) == "piloto":
    return "off", "fora_do_piloto"
```

Producao esta em `participacao = piloto`, entao **nenhuma conversa de tutor
chegou ao gerador**. O defeito viraria real no dia da mudanca para `todos` —
que e o passo natural seguinte do rollout.

### O que mudou

| Persona | Antes | Depois |
| --- | --- | --- |
| tutor, sem regiao | cotava tabela 1 (B2B) | recusa `preco_de_clinica_nao_e_para_tutor` |
| tutor, `fortaleza` / `rm` | cotava | recusa |
| tutor, `domiciliar` | cotava | cota (tabela 3, da FortCordis) |
| clinica | tabela do cadastro (RF-P14) | inalterado |

O valor B2B nao aparece nem na mensagem de erro — coberto por assercao
explicita no teste.

### O teste que virou demonstracao

`test_tool_de_preco_roda_e_texto_final_vem_do_payload_literal` era um teste de
tutor perguntando preco de eco e recebendo R$ 420,00. Passou a afirmar
`decisao == "blocked"`, `motivo == "sem_fonte"` e ausencia de `420` no texto —
a regra nova, medida ponta a ponta.

Ao reescrever, encontrei um detalhe do desenho que vale registrar: em
`blocked`, `texto_gerado` guarda **o texto recusado** (aqui o "R$ 999,00"
inventado pelo modelo). E por isso que `ultima_recusa` nao expoe
`texto_gerado`. A assercao errada era minha, nao o codigo.

### Prontidao

A sonda de `preco_servico` na persona tutor passou a usar `domiciliar`. Sondar
`fortaleza` daria verde por uma fonte que a persona nao pode usar — falso verde
da mesma familia do de 2026-08-23.

Duas fixtures (`test_whatsapp_bot_painel.py`) so cadastravam preco de
Fortaleza e ficaram vermelhas, corretamente; ganharam
`preco_domiciliar_comercial`.

### Suite

**1121 passaram, 2 skipped** (eram 1119).

### O bot e stateless — limite, nao bug

`gerar_resposta` recebe `corpo_mensagem`, sem historico. O dialogo em dois
passos da secretaria nao e implementavel hoje: no segundo turno o bot nao sabe
qual servico foi perguntado. Pergunta de preco de tutor sem mencao a domiciliar
termina em handoff — seguro, mas nao resolve.

### Fora de escopo, com dependencia declarada

1. **O texto que o tutor deveria receber.** Depende de a tabela domiciliar
   estar cadastrada; nao verificado ate o fim desta sessao.
2. **Sugerir clinica parceira pelo bairro.** Viavel — `Clinica` tem
   `latitude`, `longitude`, `bairro`, e existem `geocoding_service` e
   `logistica_service`. E feature propria, com spec propria.
3. **Intake de agendamento domiciliar** (requisicao de exame, endereco
   completo, dados do pet e do tutor): coleta multi-turno de PII com cadastro
   no sistema. Nao e trabalho de bot stateless em `suggest`; deve seguir como
   handoff.

## RF-P16 — memoria de conversa (2026-08-26)

### O que destrava

O bot era stateless: `gerar_resposta` recebia uma mensagem, sem historico. O
dialogo em dois passos da secretaria ("e domiciliar ou em clinica?" -> tutor
responde -> cotacao) nao funcionava, porque no segundo turno o bot nao sabia
qual servico fora perguntado. Passa a funcionar.

### O risco desta feature nao e tecnico, e semantico

Com mensagens antigas no contexto, o modelo passa a ter numeros plausiveis
disponiveis sem que nenhuma ferramenta tenha rodado nesta rodada. Se ele
repetir um preco do historico, a resposta PARECE fundamentada e nao esta -- e o
valor pode ter mudado.

Ao escrever o teste desse risco, descobri que a protecao tem **duas camadas**,
e que meu primeiro teste so exercitava a fraca:

```python
fontes_exigidas = _FONTE_EXIGIDA_POR_INTENT.get(intent)
if fontes_exigidas:
    fonte_presente = bool(fontes_exigidas.intersection(turno.tools_ok))  # camada 1
else:
    fonte_presente = turno.tem_fonte                                      # camada 2
```

O primeiro teste tinha o modelo respondendo sem chamar ferramenta nenhuma —
bloqueado pela camada 2, generica. A camada que realmente protege a memoria e a
1: o turno TEM fonte (consultou o horario), mas ela nao sustenta a intent de
preco. Foi preciso um segundo teste, com o modelo chamando
`consultar_horario_funcionamento` e afirmando o preco visto no historico, para
exercitar a camada certa.

### Verificacao por mutacao

| Mutacao aplicada | Testes mortos |
| --- | --- |
| `preco_servico` deixa de exigir fonte especifica | `fonte_de_outro_assunto_nao_autoriza_preco_do_historico` |
| paginacao volta a buscar a PRIMEIRA pagina | `pega_a_ultima_pagina_nao_a_primeira`, `ultima_pagina_incompleta_puxa_a_anterior` |
| historico deixa de entrar no payload | `historico_viaja_como_dado_e_nunca_nas_instrucoes`, `historico_chega_ao_payload_enviado_ao_provider` |

Cada mutacao foi confirmada no arquivo por `assert` antes de rodar a suite. Na
primeira tentativa usei `sed` com `{}` sem escape: `sed -i ''` retorna 0 mesmo
sem casar nada, e o resultado "o teste nao morreu" era **inconclusivo**, nao
negativo. Foi o que revelou a lacuna das duas camadas.

### Paginacao: a armadilha ja documentada

`/conversations/:id/messages` e ASC paginado e nao aceita ordem. `_fetch_last_message`
ja tratava isso para UMA mensagem (`limit=1` -> ultima pagina e `total`). Com
`limit=N` surge um caso que aquele nao tinha: a ultima pagina vem incompleta.
Com total=25 e limit=10, a pagina 3 tem 5 itens — buscar so ela devolveria
metade do contexto pedido sem nenhum sinal. A anterior tambem e lida e as duas
sao concatenadas.

### Suites

- Backend: **1137 passaram, 2 skipped** (eram 1121). 16 testes novos em
  `test_whatsapp_bot_memoria.py`.
- Frontend: **115 passaram**, 7 novos em `whatsapp-bot-historico.test.ts`.
  Lint limpo.

### Incidente de processo, registrado

Durante a verificacao rodei `git checkout -- app/services/` para desfazer uma
mutacao. O comando reverteu **todo** o trabalho nao commitado dos tres arquivos
da feature, nao so a mutacao. Havia backup de dois; `whatsapp_bot_prompt.py`
teve de ser reescrito.

Licao aplicada no resto da sessao: mutacao se desfaz por copia de arquivo
(`cp` de um backup explicito), nunca por `git checkout` em diretorio com
trabalho nao commitado.

### Fora de escopo

O historico nao alimenta os detectores de emergencia, cortesia e pedido de
humano — todos seguem lendo so a mensagem atual. E o comportamento correto
hoje: "bom dia" continua sendo saudacao mesmo depois de uma conversa longa.

## RF-P17 — o tutor recebe resposta, nao silencio (2026-08-26)

### Medido no painel de stage, com chamada de IA real

Persona tutor, `quanto custa o ecocardiograma?`:

> **blocked** / `sem_fonte`
> "O valor do ecocardiograma para tutor so pode ser informado quando o
> atendimento e domiciliar; em clinica, o valor e tratado pela clinica de sua
> preferencia."

A protecao da RF-P15 funcionou -- R$ 180 nao aparece. Mas `blocked` **nao envia
nada**: aquele texto e justamente o recusado. O tutor recebia silencio.

Era o beco que a propria RF-P15 registrou como pendencia. Confirmado ao vivo.

### A correcao

`ok: False` -> `ok: True` com `orientacao: "escolher_tipo_atendimento"` e
`itens: []`. A pergunta e resposta legitima, entao precisa de fonte para sair.

O que **nao** mudou: nenhum valor de tabela 1 ou 2 no payload. O teste afirma
sobre o payload inteiro (`str(res)`), nao so sobre `itens`.

### O fluxo completo, agora possivel

| Turno | Cliente | Bot |
| --- | --- | --- |
| 1 | "quanto custa o eco?" | "o valor depende do tipo de atendimento..." |
| 2 | "domiciliar" | "Ecocardiograma custa R$ 350,00." (tabela 3) |

O turno 2 **so funciona por causa da RF-P16**: o historico carrega qual exame
foi perguntado. Sem memoria, o bot nao teria a que se referir -- e foi
exatamente por isso que a RF-P15 terminou em beco.

### Tabela domiciliar confirmada em producao

Martiniano verificou o catalogo: 12 servicos, 11 com preco. Coluna
`DOMICILIAR` populada (Consulta R$ 290, Consulta + Eco R$ 580, Eco + Eletro
R$ 450, Eco + Eletro + PA R$ 525, Consulta + Eco + Eletro R$ 650,
Consulta + Eletro R$ 430).

**Pendencia da RF-P14 fechada de quebra:** `Consulta + Eletro` agora tem
`preco_rm_comercial = R$ 350,00`; estava zerado quando a RF-P14 foi escrita. A
guarda `sem_preco_na_regiao` continua valendo para lacunas futuras.

### Fora de escopo, declarado no codigo

A frase **nao** promete indicar clinica parceira pelo bairro. A capacidade nao
existe; prometer o que o bot nao faz e pior que nao oferecer. Fica como feature
propria -- `Clinica` ja tem `latitude`, `longitude` e `bairro`, e existem
`geocoding_service` e `logistica_service`.

### Verificacao por mutacao

| Mutacao | Testes mortos |
| --- | --- |
| tutor volta a poder ser cotado em `fortaleza` | **5** |
| `orientacao` deixa de virar frase deterministica | **2** |

Suite: **322 passaram, 2 skipped**.

## RF-P18 — o valor citado e qualificado como comercial (2026-08-26)

### Por que

`consultar_preco_tabela` le apenas `preco_*_comercial`. A tabela tem faixa de
plantao (`preco_*_plantao`) que o bot **nunca** consulta -- e essa e a razao
registrada de `preco_servico` estar fora do modo `auto` desde 24/08.

Ate aqui, o bot citava o valor comercial sem dizer que era comercial. Cliente
perguntando num domingo a noite receberia esse numero como se fosse o dele.

### O cadastro obrigou o desenho

Print de producao em 26/08 (icone de lua = plantao):

| Servico | Plantao cadastrado |
| --- | --- |
| Consulta | R$ 290 |
| Eco + Eletro | R$ 400 |
| Consulta + Eco | vazio |
| Consulta + Eco + Eletro | vazio |
| Consulta + Eletro | vazio |
| Eco + Eletro + PA | vazio |

Avisar **so** nos servicos com plantao preenchido daria a entender que os
outros quatro nao tem plantao -- quando a celula e que esta vazia. Silencio
seletivo afirmaria algo que o cadastro nao sustenta. Por isso o aviso vai em
toda resposta que cita valor.

### Como ficou

```
Ecocardiograma custa R$ 180,00. Esse é o valor de horário comercial.
Para plantão, confirme com a secretaria.

valores de tabela - Consulta: R$ 230,00; Ecocardiograma: R$ 180,00;
Eletrocardiograma: R$ 120,00. Esses são os valores de horário comercial.
Para plantão, confirme com a secretaria.
```

Concordancia acompanha a quantidade. A orientacao da RF-P17 nao recebe o aviso
-- nao cita valor.

### Um teste que estava medindo a coisa errada

`test_frase_nao_lista_combinacoes_nao_pedidas` afirmava `assertNotIn(";")` para
dizer "nao listou varios servicos". O aviso novo trouxe um `;` legitimo e o
teste quebrou sem que nada de errado tivesse acontecido.

A assercao passou a contar `R$`: e isso que "um preco so" quer dizer. O `;` era
proxy fragil. (O texto do aviso tambem virou duas frases curtas, que leem
melhor no WhatsApp.)

### Verificacao por mutacao

Aviso removido do renderizador => **4 falhas**, incluindo
`test_avisa_mesmo_em_servico_sem_plantao_cadastrado`.

Suite: **1147 passaram, 2 skipped**.

## RF-P19 — indicar clinica parceira perto do tutor (2026-08-26)

### De onde veio

A RF-P17 fez o tutor deixar de receber silencio, mas a resposta terminava em
"procure a clinica de sua preferencia" -- sem dizer qual. Correto e inutil.

### Desenho

| Situacao | `criterio` | Resposta |
| --- | --- | --- |
| bairro informado, ha parceira | `bairro` | nome, bairro, endereco, telefone |
| sem bairro, tutor tem coordenadas | `distancia` | as 2 mais proximas, por haversine |
| bairro informado, sem parceira | `sem_clinica_no_bairro` | "nao temos parceira em X ainda" |
| sem bairro e sem coordenadas | `precisa_bairro` | "me diga em que bairro voce fica" |

**Sem chamada externa.** Geocodificar o bairro exigiria `GOOGLE_MAPS_API_KEY` e
HTTP dentro do worker -- latencia, custo e uma dependencia externa num caminho
que precisa falhar fechado. `Tutor` e `Clinica` ja tem `latitude`/`longitude`, e
`_haversine_km` ja existe em `logistica_service` (importado, nao reescrito:
duas implementacoes de distancia divergiriam em silencio).

**Estrategias nao encadeiam.** Bairro sem parceira NAO cai na lista por
distancia. Coberto por teste: o tutor tem coordenadas, a estrategia 2 existe, e
ainda assim nao entra.

### O risco central nao e o cliente, e a persona

Uma clinica parceira perguntando onde ficam as outras receberia o mapa da rede
de um concorrente. A defesa e `TOOLS_POR_PERSONA` -- a tool nao existe na
persona clinica --, nao instrucao de prompt.

### A lacuna que a mutacao encontrou

Primeira rodada de mutacao:

| Mutacao | Testes mortos |
| --- | --- |
| tool liberada para a persona clinica | 2 |
| bairro sem parceira cai na lista por distancia | 1 |
| **guardrail deixa de ancorar endereco/telefone** | **0** |

Zero. Ou seja: nao havia teste cobrindo a integracao com a RF-022. Sem aquela
ancoragem, uma resposta citando endereco cairia em `endereco_sem_fonte` e o
telefone em `contato_fora_da_fonte` -- a feature ficaria **muda em producao** e
nenhum teste avisaria.

`GuardrailDaClinicaProximaTest` cobriu isso, com contraprova: o mesmo texto sem
a tool e barrado, e telefone que a tool NAO devolveu continua barrado
(`contato_fora_da_fonte`). Refeita a mutacao: **1 teste morto**.

### Portugues que o teste nao pegava

Tres defeitos so visiveis lendo a saida:

- "no Aldeota" -> "no bairro Aldeota". O genero varia (o Centro, a Aldeota) e
  nao ha como acerta-lo a partir do nome.
- "tratados direto com ela" depois de DUAS clinicas -> fecho neutro.
- "Uma pessoa da equipe..." seguido do sufixo da RF-024 dizia "pessoa" duas
  vezes em duas frases. O encaminhamento ja vem do sufixo.

### Suite

**1166 passaram, 2 skipped** (eram 1150). 16 testes novos.

### Fora de escopo

Bairro que o cliente escreve diferente do cadastro ("Pq. Araxa" vs "Parque
Araxa") so casa por substring. Sem normalizacao de apelido de bairro nem
geocodificacao, a cobertura depende de o cadastro usar o nome corrente.

### Conferencia do cadastro de producao (26/08) e um defeito que ela revelou

Consultado `/api/v1/clinicas` em producao, pela sessao do navegador:

| Campo | Preenchido |
| --- | --- |
| total ativas | 162 |
| bairro | 159 (98%) |
| coordenadas | 157 (97%) |
| endereco | 159 (98%) |
| **telefone** | **118 (73%)** |

Cobertura boa. 88 bairros distintos, 54 deles com uma unica clinica -- o corte
em 2 sugestoes esta adequado.

**O defeito:** o cadastro cobre **8 cidades** (Fortaleza, Caucaia, Maracanau,
Maranguape, Eusebio, Aracati, Itaitinga, Pacatuba), e nome de bairro nao e
unico entre elas. `Centro` tem **10 clinicas em 5 cidades**. A versao inicial
devolvia as primeiras da lista: um tutor de Caucaia dizendo "Centro" receberia
a `Amo Pet` de Maranguape, a ~40 km, anunciada como "a mais perto de voce".

Duas correcoes:

1. **Desempate por distancia** dentro do casamento por bairro, quando o tutor
   tem coordenadas. Ordenacao parcial e recusada (`None`, nao "ordem
   preservada"): ordenar umas e deixar outras no fim por acaso seria pior.
2. **Cidade no payload e na frase.** Sem ela o cliente nao teria como perceber
   a ambiguidade.

E uma terceira, de honestidade: **"mais perto" so e dito quando houve
calculo**. Sem coordenadas a frase vira "a clinica parceira que temos por ai",
sem prometer proximidade que ninguem mediu.

Mutacao do desempate => 1 teste morto. Suite: **1168 passaram, 2 skipped**.

### Lacuna de cadastro, para decisao de negocio

**44 clinicas (27%) nao tem telefone.** A resposta omite o campo e segue
valida -- nome, bairro, cidade e endereco bastam para o cliente chegar --, mas
a indicacao fica menos util. Nao e defeito de codigo; e cadastro a preencher.

### Correcao de campo: WhatsApp antes de telefone (27/08)

A primeira versao lia `Clinica.telefone`. Martiniano corrigiu: **o numero que
importa e o `whatsapps`** -- e o canal por onde a clinica se comunica, tanto
com a FortCordis quanto **com os proprios clientes**.

Essa segunda metade resolve a duvida que eu tinha levantado: parecia contato
B2B, e dar um canal interno a consumidor final seria incomodo para o parceiro.
Nao e o caso -- e o numero publico de atendimento da clinica.

Resposta passa a citar `WhatsApp (85) 99999-8888`; telefone fixo so quando nao
ha WhatsApp cadastrado. `whatsapps` e coluna JSON e aceita lista ou string
serializada; a normalizacao reusa `_whatsapps` de `assistente_ia_clinics360`.

**A mesma lacuna de antes reapareceu.** Depois de ancorar o WhatsApp no
guardrail, a mutacao (`ancorar so telefone`) matou **zero** testes: o payload
do teste de guardrail ainda usava `telefone`. Sem cobertura, uma resposta
citando WhatsApp seria barrada por `contato_fora_da_fonte` em producao com a
suite verde. Corrigido; refeita a mutacao, **1 teste morre**.

Suite: **1171 passaram, 2 skipped**.

### Medicao da lacuna de cadastro: pendente

A contagem de 44 sem contato era do campo `telefone`, nao do `whatsapps` -- ou
seja, **nao mede o que importa**. A remedicao ficou bloqueada: a sessao do
navegador expirou (401) e o login do usuario estava em outro navegador. Comando
de VPS entregue para ele rodar; numero real ainda desconhecido.
