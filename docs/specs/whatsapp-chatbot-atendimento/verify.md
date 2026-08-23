# Verify - whatsapp-chatbot-atendimento

Data: 2026-08-20  
Responsavel: Martiniano + Claude  
Status: draft

> Fases 1-3 entregues em 2026-08-22 (schema/config, gatilho/fila/worker,
> portões/identidade/guardrails de entrada). Fase 4 (geração e guardrails de
> saída) entregue em código em 2026-08-23, mas **não fechada**: nenhum envio ao
> cliente existe (RF-027 é Fase 6) e a auditoria da entrega levantou quatro
> divergências entre spec e código, registradas na seção "Divergências entre
> spec e código" abaixo. Com o bot habilitado, toda mensagem real hoje termina
> em `suppressed`, `handoff`, `blocked` ou `draft`. As Fases 5 e 6 seguem
> pendentes. Nenhum item é marcado como `ok` sem teste ou log correspondente.

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
| CA-013 | aceitação | teste de escopo: contexto `ambiguous`/`not_found` -> resposta sem dado de registro | parcial — `test_whatsapp_bot_generation.test_identidade_nao_resolvida_nao_chama_provider` e `test_whatsapp_bot_process_job.test_todos_portoes_abertos_com_identidade_nao_resolvida_vira_handoff` cobrem só `not_found`. O ramo `ambiguous` de `whatsapp_bot_context.build_safe_context` (`whatsapp_bot_context.py:50`) não tem teste nenhum — e é justamente ele que impede o vazamento, porque em `ambiguous` as listas `clinicas`/`tutores` vêm populadas com os candidatos |
| CA-014 | aceitação | teste de allowlist: intent fora da lista em conversa `auto` -> `draft` | parcial — `test_whatsapp_bot_generation.test_intent_fora_da_allowlist_em_auto_vira_blocked` passa, mas grava `decisao="blocked"`, não `draft` como o CA pede (ver divergência D1). Nada é enviado nos dois casos, mas `blocked` não entra na fila de rascunho pendente (`schemas/whatsapp_bot.py:49`), o que muda o que a Fase 5 mostra ao atendente |
| CA-015 | aceitação | teste do validador: candidata com conteúdo clínico -> `blocked` + motivo gravado | parcial — `test_whatsapp_bot_generation.test_conteudo_clinico_gerado_vira_blocked_com_motivo` + `test_whatsapp_bot_guardrails.GuardrailBloqueioClinicoTest` (6 termos, inclui vazamento de laudo) asseveram `blocked` e o motivo **no dataclass**; nenhum teste lê `whatsapp_bot_respostas.motivo` de uma linha já persistida. A gravação existe (`whatsapp_bot_worker_service.py:146`) mas não está assegurada |
| CA-016 | aceitação | teste de fonte: sem tool e sem trecho recuperado -> não envia | parcial — `test_whatsapp_bot_guardrails.GuardrailFonteEAncoragemTest.test_sem_fonte_nao_responde` cobre o validador isolado. No fluxo real o ramo é **inalcançável**: `consultar_horario_funcionamento` devolve `ok=True` incondicionalmente quando chamada sem `data` (`whatsapp_bot_tools.py:179`), e `tem_fonte` é por turno, não por afirmação — ver divergência D3 |
| CA-017 | aceitação | teste de teto: acima do limite diário -> `suppressed` com motivo de teto | ok — `test_whatsapp_bot_generation.test_teto_diario_suprime_antes_de_gastar_token` (decisão `suppressed`, motivo `teto_diario`, `provider.generate` não chamado); teto aplicado em `whatsapp_bot_generation.py:127-135` antes de gastar token. Ressalva: `contar_respostas_do_dia` só soma `decisao == "sent"`, que não é alcançável até a Fase 6 — em tráfego real o contador é sempre 0 hoje |
| CA-018 | aceitação | teste de envio em `auto`: chamada ao Node com `metadata.origem = "bot"` | pendente — envio adiado para a Fase 6 por dependência real do lado Node: `sendConversationMessage` crava `{source: "agent_api"}` (`whatsapp-stage-backend/src/controllers/conversationsController.ts:611`) e não aceita `metadata` do chamador; o endpoint também não tem idempotência. Não existe nenhum `httpx.post` no backend do bot. Hoje só há `test_whatsapp_bot_generation.test_aprovada_em_auto_ainda_nao_envia_nesta_fase` |
| CA-019 | aceitação | teste do preview: nenhum job alterado, nenhuma geração, nenhum envio | ok — `test_whatsapp_bot_endpoints.test_preview_nao_altera_nada_e_conta_por_status_e_decisao` (endpoint é só leitura/agregação; contagens de jobs/respostas antes e depois idênticas) |
| CA-020 | aceitação | teste de autorização em `test_configuracoes_autorizacao.py` (403 para não admin) + smoke sem restart | ok — 5 testes novos em `test_configuracoes_autorizacao.py` (403 para `whatsapp_bot_atendimento_habilitado` e `whatsapp_bot_modo`, 422 para modo invalido, reenvio sem mudança permitido para não-admin, admin habilita e muda modo); "sem restart" decorre de `is_whatsapp_bot_enabled()`/`resolve_conversation_mode()` lerem o banco a cada chamada, sem cache — não medido em stage real |
| CA-021 | aceitação | teste do worker com advisory lock ocupado: ciclo pulado, 0 jobs tocados | ok — `test_whatsapp_bot_worker_service.test_run_due_once_pula_ciclo_com_lock_distribuido_ocupado` |
| CA-022 | aceitação | teste de redação de log: corpo completo e número completo ausentes da saída | **pendente — rebaixado de `ok` em 2026-08-23**. A revisão estática da Fase 3 estava errada: nenhum `logger.*` cita `wa_identity` diretamente, mas o número entra pela URL. `_fetch_conversation_by_phone` monta `params={"phone": wa_identity}` (`whatsapp_bot_worker_service.py:436-442`) e o `raise_for_status()` produz uma `HTTPStatusError` cujo texto inclui a query string completa; ela sobe até o `logger.exception` de `run_due_once` (`:319`) **e** é gravada em `whatsapp_bot_jobs.last_error` (`:322`). Reproduzido localmente: `str(exc)` contém `phone=5585999990001`. Nenhum teste da suíte usa `assertLogs`/`assertNoLogs` |
| CA-023 | aceitação | teste de escopo entre personas: conversa `clinica` sem dado de tutor de outra clínica, e vice-versa | parcial — `test_whatsapp_bot_tools.test_tutor_nao_ve_laudo_de_outro_tutor`, `..._clinica_nao_ve_laudo_de_outra_clinica`, `test_escopo_cruzado_e_recusado` e `test_payload_de_laudo_nao_carrega_campo_clinico` provam o filtro por código em `whatsapp_bot_tools.py:318-330`. Duas ressalvas: o recorte de agendamentos por persona (`whatsapp_bot_context.py:97-121`) não tem teste, e o código protegido pelos dois primeiros testes **não é alcançado pelo fluxo real** (divergência D3) |
| CA-024 | aceitação | teste de allowlist: intent de OS/cobrança em `auto` -> `draft` nas duas personas | parcial — `test_whatsapp_bot_guardrails.GuardrailAllowlistDeIntentTest.test_bloco_comum_sempre_vira_rascunho_nas_duas_personas` cobre tutor e clínica no nível do validador; no fluxo completo só existe o caminho tutor, e ele termina em `blocked`, não `draft` (divergência D1). Nenhum teste semeia `OrdemServico` real — o que o fluxo cobre é `test_contexto_do_prompt_nao_carrega_ordem_de_servico` (OS nunca entra no prompt) |
| CA-025 | aceitação | teste de handoff: fora da janela informa próximo horário; dentro, informa transferência; emergência mantém contato imediato | ok — `test_whatsapp_bot_handoff_service.py`: dentro do expediente (`test_build_handoff_message_dentro_do_expediente_informa_transferencia`), fora dele com o próximo horário (`..._fora_do_expediente_informa_proximo_horario`, `..._tarde_de_sabado_aponta_segunda`); emergência usa `EMERGENCY_FIXED_MESSAGE` sempre, independente de horário (`test_whatsapp_bot_process_job.test_emergencia_ignora_pausa_e_janela_fechada`) |
| CA-026 | aceitação | teste de corrida: claim durante o debounce -> job `suppressed`, sem envio e sem rascunho | ok — `test_whatsapp_bot_process_job.test_claim_detectado_no_node_pausa_e_grava_estado_local` (`last_agent_id` preenchido no Node -> `suppressed`/`pausado`, nenhum PATCH/alerta/push chamado) |
| NFR-001 | não funcional | inspeção de `config.py`/`.env.example`/migração: todos os defaults desligados | ok — `WHATSAPP_BOT_ENABLED=False` (`backend/app/core/config.py`), `whatsapp_bot_atendimento_habilitado`/`whatsapp_bot_modo` nascem `false`/`suggest` (migração `20260820_75`, testado em `test_whatsapp_bot_migration.test_upgrade_adiciona_colunas_em_configuracoes_com_default_seguro`) |
| NFR-002 | não funcional | medição do tempo do endpoint de mensagem recebida antes e depois do enfileiramento | ok (ordem de grandeza) — 30 chamadas locais em sqlite, com enfileiramento: média 2.77ms / p95 0.98ms; sem os campos novos (payload antigo): média ~0ms. Bem abaixo do orçamento de ~50ms; não é uma medição de stage/produção com Postgres real |
| NFR-003 | não funcional | `build_runtime_report()` expondo `whatsapp_bot_worker` | ok — `report["observability"]["whatsapp_bot_worker"]` com `enabled`, `status`, `thread_alive`, `worker_started`, `stop_signal_set`, `poll_seconds`, `pending_jobs`, `last_cycle_at`, verificado por inspeção direta (`build_runtime_report()`) e pela suíte completa (nenhuma regressão nos demais workers) |
| NFR-004 | não funcional | revisão dos logs emitidos em um ciclo completo em stage | **pendente — rebaixado de `parcial` em 2026-08-23**. Um ciclo de sucesso não emite log próprio da Fase 4, mas o ciclo de erro vaza o número completo (ver CA-022) e nenhuma máscara de 4 dígitos existe no fluxo do bot, ao contrário do que o NFR pede. Revisão de log real em stage segue não feita |
| NFR-005 | não funcional | contadores de custo por conversa em `whatsapp_bot_respostas` + degradação para `suggest` | parcial — metade A (contadores) existe: `whatsapp_bot_providers.py:134-135` lê `usage`, `whatsapp_bot_generation.py:229-231` carrega e `_record_resposta` persiste `input_tokens`/`output_tokens`/`latencia_ms`; asseverado só no dataclass (`test_whatsapp_bot_generation.py:264-266`), nenhum teste lê os tokens de uma linha persistida. Metade B (teto global diário + degradação para `suggest`) **não existe**: sem chave em `config.py` e sem código que force `suggest` por estouro de custo |
| NFR-006 | não funcional | teste de migração idempotente (aplicar duas vezes, e no-op sem tabela) | ok — `backend/tests/test_whatsapp_bot_migration.py` (4 testes: tabelas+índices, unicidade de `wa_message_id`, colunas em `configuracoes` com default seguro, no-op sem `configuracoes`), rodado duas vezes em sequência em cada teste |
| NFR-007 | não funcional | inspeção: nenhuma query do backend principal em `conversations`/`messages` | ok — a reconciliação (`whatsapp_bot_worker_service.run_reconciliation_sweep`) só fala com o Node via `httpx` + `x-whatsapp-internal-token` (`GET /conversations`, `GET /conversations/:id/messages`); nenhum acesso direto ao Postgres do whatsapp-stage-backend em nenhum arquivo desta fase |

## Divergências entre spec e código (auditoria da Fase 4, 2026-08-23)

Levantadas por auditoria adversarial da entrega da Fase 4, cada uma confirmada
lendo o código e executando o teste correspondente. Nenhuma foi resolvida no
commit da Fase 4: o processo do projeto manda parar e avisar, não escolher um
dos lados em silêncio. **Nenhuma delas permite envio ao cliente** — não existe
código de envio nesta fase —, mas D3 e D4 precisam de decisão antes da Fase 5.

### D1 — intent fora da allowlist grava `blocked`, e a spec pede `draft`

RF-019 diz que intent fora da allowlist "sempre vira rascunho, mesmo com a
conversa em `auto`", e CA-014/CA-024 pedem `draft`. O código devolve
`GuardrailVeredito(aprovado=False, motivo="intent_fora_allowlist")`
(`whatsapp_bot_guardrails.py:259-266`) e `whatsapp_bot_generation.py:236-240`
converte qualquer veredito reprovado em `decisao="blocked"`. O teste assume
essa leitura já no nome (`test_intent_fora_da_allowlist_em_auto_vira_blocked`).

Consequência prática: `blocked` e `draft` são igualmente seguros hoje (nada é
enviado), mas a Fase 5 lista rascunho pendente por `decisao == "draft"`
(`schemas/whatsapp_bot.py:49`). Se ficar como está, uma resposta boa recusada
só por não ser auto-elegível **não aparece para o atendente**, e a spec previa
o contrário. Decisão necessária: ou `intent_fora_allowlist` passa a produzir
`draft`, ou a spec passa a tratar `blocked` como rascunho e a Fase 5 lista os
dois.

### D2 — `avaliar_resposta` recebe `modo` e nunca usa

`avaliar_resposta(..., modo: str, ...)` (`whatsapp_bot_guardrails.py:193-199`)
não referencia `modo` em nenhum ponto do corpo. A allowlist da RF-019 é descrita
na spec como regra **do modo `auto`**; aplicada também em `suggest`, ela reprova
uma resposta correta num modo em que um humano revisa tudo antes de enviar.

Combinada com D1, o efeito é: em `suggest`, pergunta fora da allowlist vira
`blocked` em vez de rascunho para o atendente editar — exatamente o caso de uso
que justifica o modo copiloto.

### D3 — não existe loop de tool call: as tools de dado nunca rodam

O mais grave. `execute_bot_tool` só é chamado em `whatsapp_bot_generation.py:160`
e `:167`, sobre o conjunto fixo `_TOOLS_DE_PARTIDA`
(`consultar_horario_funcionamento`, `consultar_dados_institucionais`) mais
`buscar_conhecimento_institucional`. `TOOL_SCHEMAS` é enviado ao provider
(`:191`), mas `GeneratedReply.tool_calls` (`whatsapp_bot_providers.py:52`) nunca
é preenchido nem lido, e `MAX_TOOL_ROUNDS` (`:28`) é código morto.

Decorre disso:

- `consultar_status_laudo` e `consultar_preco_tabela` são **inalcançáveis** —
  duas das sete intents da allowlist de `auto` da RF-019 ficam inservíveis.
  `preco_servico` sempre bate em `valor_fora_tabela` (o valor não tem âncora);
  `status_laudo` só passa quando o modelo **inventa** o status.
- RF-020 ("sem fonte o bot não afirma nada") fica inerte no fluxo real:
  `tem_fonte` é por turno, não por afirmação (`whatsapp_bot_guardrails.py:107`),
  e `consultar_horario_funcionamento` devolve `ok=True` incondicionalmente
  quando chamada sem `data` (`whatsapp_bot_tools.py:179`). Ter consultado o
  horário conta como fonte para qualquer coisa dita no mesmo turno.
- O escopo por código da RF-018 (CA-023) está implementado e testado, mas
  protege um caminho que o fluxo não alcança.

Sonda somente-leitura sobre o gerador, com provider fake e sqlite temporário,
confirmou os três pontos: em todos os turnos as tools executadas são exatamente
as três de partida, e um texto afirmando "o laudo do Thor já está pronto" foi
aprovado como `draft` sem que `consultar_status_laudo` tivesse rodado.

Não confirmado (exige rede): pelo contrato de `responses.parse`, se o modelo
emitir `function_call` o `output_parsed` volta `None` e o provider levanta
`invalid_structured_output` (`whatsapp_bot_providers.py:125-129`), virando
handoff. Precisa de verificação com o provider real antes da Fase 6.

### D4 — número completo vaza em log e em `whatsapp_bot_jobs.last_error`

Descrito em CA-022. Não é regressão da Fase 4 — o código é da Fase 3 —, mas a
revisão estática que marcou CA-022 como `ok` não olhou a query string. Correção
provável: mascarar o número na URL do erro, ou capturar `HTTPStatusError` em
`_fetch_conversation_by_phone`/`_fetch_last_message` e relançar com mensagem
redigida. Precisa também do teste com `assertLogs` que o CA-022 sempre pediu.

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
venv/bin/python -m unittest tests.test_whatsapp_bot_guardrails -v
venv/bin/python -m unittest tests.test_whatsapp_bot_tools -v
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
  nenhuma chamada a provider real, em stage ou fora dele. Some-se a isso D1-D4.
- Serviço WhatsApp: não tocado nesta fase. A mudança que a RF-027 exige
  (`sendConversationMessage` aceitar `metadata` do chamador, hoje cravado em
  `{source: "agent_api"}`) continua por fazer e é pré-requisito da Fase 6.
- Frontend: não tocado nesta fase (é a Fase 5).

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
