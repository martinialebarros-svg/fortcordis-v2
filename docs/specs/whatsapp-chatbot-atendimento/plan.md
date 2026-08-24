# Plan - whatsapp-chatbot-atendimento

Data: 2026-08-20
Responsavel: Martiniano + Claude
Status: draft

## Sequência de fases

Cada fase é entregável e reversível sozinha. As fases 1-3 não gastam nenhum
token de LLM e não enviam nenhuma mensagem: montam e validam todo o encanamento
com o gerador desligado. Só a Fase 4 liga o modelo, e só a Fase 6 permite que
uma mensagem gerada chegue a um cliente.

- Fase 1 (DB/config): tabelas, colunas de `configuracoes`, settings.
- Fase 2 (gatilho e fila): payload Node -> Python, enfileiramento, worker,
  debounce, reconciliação.
- Fase 3 (portões, identidade e guardrails de entrada): nono dígito, contexto,
  emergência, handoff — com gerador stub.
- Fase 4 (geração): tools próprias, prompt, validador de saída, registro.
- Fase 5 (frontend): rascunho na central, selo, controles por conversa, card em
  Configurações.
- Fase 6 (rollout): evals, canary em stage, copiloto em produção, `auto` na
  allowlist.

## Tarefas por fase

### Fase 1 - schema e configuração

- [x] P1.1 migração `20260820_75_whatsapp_bot_atendimento.py`: `whatsapp_bot_jobs`,
      `whatsapp_bot_respostas`, `whatsapp_bot_conversa_estado` e as duas colunas
      novas em `configuracoes`, idempotente, no padrão das migrações 72-74.
- [x] P1.2 models correspondentes em `app/models/whatsapp_bot.py` e campos novos
      em `app/models/configuracao.py`.
- [x] P1.3 settings `WHATSAPP_BOT_*` em `app/core/config.py` + `.env.example`,
      todas com default seguro (RF-008, NFR-001).
- [x] P1.4 teste de migração (idempotência, no-op sem tabela), no padrão de
      `test_whatsapp_reminder_migration.py`.
- Critério de conclusão: migração aplica no sqlite de dev, suíte de backend sem
  regressão, nenhum comportamento novo em runtime. **Cumprido em 2026-08-22**:
  migração `20260820_75` aplicada via `setup_database.py` num sqlite novo (88
  migrações), `unittest discover` completo em 850/850 sem falha. Nenhum service
  ou endpoint novo criado; as tabelas e colunas ficam sem leitor/escritor até a
  Fase 2.
- Risco: baixo — só schema.
- Rollback: colunas e tabelas novas ficam sem uso; nenhuma migração reversa é
  necessária.

### Fase 2 - gatilho, fila e worker

- [x] P2.1 campos opcionais em `WhatsAppInboundMessageNotificationRequest` e o
      envio deles em `whatsappPushNotificationService.ts` (RF-001).
- [x] P2.2 enfileiramento em `notify_whatsapp_inbound_message`, isolado em
      try/except próprio, sem afetar o push (RF-002, CA-004).
- [x] P2.3 `app/services/whatsapp_bot_queue_service.py`: criar job com debounce,
      supersede do job `pending` anterior, unique por `wa_message_id`
      (RF-003, RF-004).
- [x] P2.4 `app/services/whatsapp_bot_worker_service.py`: loop, lock local,
      advisory lock com chave `80433003`, retry com `attempts`/`last_error`
      (RF-005, RF-007) — processando com gerador stub que só marca `suppressed`.
- [x] P2.5 wire em `app/main.py` (start/shutdown junto aos demais workers) e
      estado em `app/core/runtime_checks.py` (NFR-003).
- [x] P2.6 varredura de reconciliação contra `GET /conversations` do Node
      (RF-006), com cliente HTTP dedicado usando `x-whatsapp-internal-token`.
- [x] P2.7 testes: dedupe, debounce/supersede, retry/limite, lock ocupado,
      reconciliação, e o teste de que falha no enfileiramento não quebra o push.
- Critério de conclusão: jobs entram, o worker consome e nada é gerado nem
  enviado; `unittest discover` sem regressão. **Cumprido em 2026-08-22**:
  smoke end-to-end manual (webhook -> `enqueue_job_for_inbound_message` ->
  worker -> `whatsapp_bot_respostas.decisao='suppressed'`) confirmado num
  sqlite de dev real, com o worker rodando de verdade (thread + poll). Suíte
  completa do backend em 868/868 (18 testes novos desta fase). Nota de escopo:
  RF-008 (os dois interruptores) ainda não bloqueia o processamento do
  worker nesta fase — isso é o gate da Fase 3 (P3.2); o worker desta fase
  sempre processa e sempre termina em `suppressed`, nunca em geração ou
  envio, então rodar incondicionalmente é seguro. `is_whatsapp_bot_enabled()`
  já existe e alimenta o campo `enabled` da observabilidade (NFR-003), mas
  não gateia o loop ainda.
- Risco: o endpoint de mensagem recebida está no caminho quente do webhook — se
  o enfileiramento demorar ou levantar, o Node perde o push. Mitigado por
  try/except próprio, uma única linha gravada e NFR-002.
- Rollback: remover a chamada de enfileiramento do endpoint e o worker de
  `main.py`; o payload extra do Node passa a ser ignorado.

### Fase 3 - portões, identidade e guardrails de entrada

- [x] P3.1 correção do nono dígito em `_has_exact_phone`/`resolve_whatsapp_context`
      (RF-015), com teste cobrindo a forma canônica vinda do Node (CA-012).
- [x] P3.2 `whatsapp_bot_gates.py`: toggles, modo por conversa, pausa por humano,
      janela de 24h, tipo de mensagem (RF-008 a RF-013).
- [x] P3.3 detecção de pedido de humano e de emergência, com listas versionadas
      em `backend/data/`, no padrão do vocabulário do ai-echo (RF-011, RF-023).
- [x] P3.4 handoff: `PATCH /conversations/:id/status` no Node, `criar_alerta_interno`
      e push (RF-011, RF-023).
- [x] P3.4b texto de handoff ciente do expediente (RF-033): dentro da janela
      operacional informa transferência, fora dela informa o próximo horário de
      atendimento, reaproveitando `_agenda_day_window`/`_agenda_configuration_rules`.
- [x] P3.5 endpoints de estado por conversa e `GET /whatsapp/bot/preview`
      somente leitura (CA-019).
- [x] P3.6 testes de cada portão e do fluxo de emergência sem chamada ao LLM.
- Nota de escopo (não listado como P-task, mas necessário para RF-008/CA-020
  serem testáveis de ponta a ponta): `PUT /configuracoes` ganhou
  `whatsapp_bot_atendimento_habilitado`/`whatsapp_bot_modo` na allowlist,
  com guarda admin-only e validação de enum, no mesmo padrão de
  `whatsapp_lembrete_automatico_habilitado`.
- Critério de conclusão: com o bot "habilitado", toda mensagem real termina em
  `suppressed` ou `handoff` — o caminho inteiro é exercitado sem gerar texto.
  **Cumprido em 2026-08-22**: `_process_job` agora e uma arvore de decisao
  completa (enabled -> modo/pausa -> emergencia -> claim/from_me -> tipo ->
  pedido de humano -> janela -> fallback suppressed), coberta por 11 testes
  de integracao (`test_whatsapp_bot_process_job.py`) que simulam cada ramo
  com o Node mockado, mais 10 testes unitarios dos portoes isolados
  (`test_whatsapp_bot_gates.py`) e 8 do servico de handoff
  (`test_whatsapp_bot_handoff_service.py`). Nenhum caminho chama gerador ou
  envia mensagem ao cliente - `texto_gerado` fica gravado (fixo, nao gerado
  por LLM) para a Fase 6 so precisar ligar o envio de fato. Smoke manual
  live confirmou que o worker sobrevive a uma falha de rede do Node
  (RuntimeError -> attempts incrementado -> retry no proximo ciclo, sem
  derrubar a thread).
- Risco: a correção do nono dígito toca um endpoint em uso pela central
  (`whatsapp-contexto`); precisa de teste de não regressão para os formatos que
  já funcionam hoje. **Coberto**: `test_whatsapp_conversation_context.py`
  ganhou 2 casos novos (identidade canonica sem nono digito, e um fixo de
  12 digitos que nao deve ganhar variante fantasma) sem alterar nenhum dos
  4 testes existentes.
- Rollback: reverter o gate service; a correção do nono dígito é independente e
  pode ficar (é melhoria isolada).

### Fase 4 - geração e guardrails de saída

- [x] P4.1 `whatsapp_bot_tools.py`: allowlist própria, escopo de
      `tutor_id`/`clinica_id` aplicado no código (RF-018), alcançável por loop
      stateless de tool call com no máximo duas rodadas.
- [x] P4.2 `whatsapp_bot_prompt.py`: as duas personas (`tutor` e `clinica`) por
      `match_type`, versão de prompt, regra de "só falo do que veio de fonte"
      (RF-017, RF-020, RF-021).
- [x] P4.3 classificação de intent contra a allowlist **por persona** da RF-019,
      incluindo o bloco comum que sempre vira rascunho (OS, cobrança, valor em
      aberto). Segurança editorial e elegibilidade ao modo `auto` são decisões
      separadas; `suggest` mantém a resposta editável.
- [x] P4.4 validador de saída (RF-022), fonte específica por intent, tetos de
      volume/tamanho (RF-025) e teto global diário de tokens (NFR-005).
- [ ] P4.5 registro completo em `whatsapp_bot_respostas` (RF-026) e envio via
      Node no modo `auto` com `metadata.origem = "bot"` (RF-027). **Metade
      entregue**: o registro grava os 12 campos da RF-026. A Fase 5 adicionou
      ao Node metadata interno validado e idempotência para rascunho de
      `suggest` aprovado por atendente; o envio sem revisão no modo `auto`
      continua proibido e foi movido para a Fase 6, ver CA-018.
- [x] P4.6 testes com provider fake (sem rede), no padrão dos providers
      protocolares do ai-echo: intent fora da allowlist (nas duas personas),
      escopo cruzado clínica/tutor, resposta clínica bloqueada, resposta sem
      fonte, tool loop stateless, teto estourado, persistência dos campos de
      auditoria e redação de telefone em erro/log.
- Critério de conclusão: em stage, com conversa em `suggest`, rascunhos reais
  aparecem gravados e nenhum envio acontece. **Cumprido no backend de stage em
  2026-08-23**: após corrigir uma ambiguidade cadastral fail-closed, o job real
  `21` resolveu a persona `tutor`, chamou `consultar_preco_tabela`, gravou
  `draft/modo_suggest` com modelo, prompt, tools, tokens e latência e deixou
  `texto_enviado` vazio. A inbox registrou somente o inbound `received`, com
  zero mensagens `from_me` na janela do teste. Exibir e operar esse rascunho na
  central continua sendo o critério próprio da Fase 5, não um bloqueio da
  geração/persistência da Fase 4.
- Risco: o maior da entrega. Mitigado por `suggest` como padrão, validador de
  saída e allowlist estreita. No runtime de stage validado para esta fase não
  havia envio; o endpoint de aprovação humana foi implementado depois, na
  Fase 5, e ainda não foi publicado.
- Rollback: `configuracoes.whatsapp_bot_modo = 'off'` para todas as conversas, ou
  desmarcar o toggle institucional.

### Fase 5 - central de atendimento e Configurações

- [x] P5.1 painel de rascunho acima do composer com Enviar / Editar e enviar /
      Descartar (RF-028), incluindo claim atômico, feedback e idempotência no
      transporte Node.
- [x] P5.2 selo de mensagem do bot na timeline (RF-029), aceito somente em
      chamadas autenticadas pelo token interno.
- [x] P5.3 controles de modo e pausa por conversa (RF-030); `auto` permanece
      visível, porém bloqueado até o rollout.
- [x] P5.4 card "Atendimento automático (WhatsApp)" em Configurações -> Empresa
      (RF-031), no padrão do card do lembrete e gravável somente por admin.
- [x] P5.5 testes de endpoint/autorização e contrato, `tsc --noEmit`, `eslint`,
      builds Node/Next e suíte focada do chatbot limpos; smoke autenticado da
      tela publicada em stage aprovado sem envio externo.
- [x] P5.6 separar identidade interna e destinatário Graph para celulares
      brasileiros: a conversa continua canônica sem nono dígito, enquanto
      texto e anexo saem em E.164 móvel com o nono dígito. A regressão cobre
      celular nas duas formas, fixo brasileiro e número internacional.
- [x] P5.7 rotear **Reenviar** de mensagem do bot pelo endpoint idempotente da
      resposta Python e ocultar o botão de uma falha histórica já substituída
      por entrega reconciliada. Mensagens humanas falhas mantêm o reenvio
      genérico existente.
- Critério de conclusão: um atendente consegue operar o copiloto inteiro pela
  tela, sem console nem chamada manual de API. **Implementação publicada em
  stage no SHA `02566851` em 2026-08-23. A tela autenticada exibiu o rascunho
  real, os três controles, modo/pausa e o card institucional; o modo de edição
  foi aberto e cancelado sem perda de texto. Depois de confirmação explícita,
  uma tentativa de Enviar foi feita: a Meta recusou a identidade canônica sem
  nono dígito com `131030`, sem aceitar mensagem externa, e o rascunho voltou
  corretamente a `draft`. P5.6 foi publicada em stage no SHA `5f6ca72b` e,
  após nova confirmação, o reenvio único foi aceito e marcado `delivered` pela
  Meta. O estado interno foi reconciliado sem nova chamada externa; P5.7 fecha
  o desvio encontrado no botão genérico de reenvio e foi publicada somente em
  stage no SHA `29f68f22`, com workflows, runtime e smoke autenticado
  aprovados.**
- Risco: baixo; a tela já existe e a mudança é aditiva.
- Rollback: esconder o painel por flag de UI mantém o backend intacto.

### Fase 6 - rollout e observabilidade

- [x] P6.1 casos de regressão em `backend/evals/whatsapp_bot_cases.json`, no
      padrão de `assistente_ia_admin_cases.json`, cobrindo cada guardrail.
      **Entregue 2026-08-23**: 27 casos + `test_whatsapp_bot_evals.py` (9
      testes), determinísticos e sem rede. Cobrem os quatro grupos clínicos,
      vazamento de laudo, fonte ausente e fonte de outra intent, valor/prazo
      não ancorados com os pares aprovados, o bloco comum da CA-024 nas duas
      personas e o teto de caracteres. `teto_diario` fica de fora por depender
      de contagem no banco (já coberto em `test_whatsapp_bot_generation`).
- [ ] P6.2 `GET /whatsapp/bot/preview` rodado em stage antes de qualquer
      habilitação, para medir alcance real (mesma prática que revelou os 10
      agendamentos elegíveis no lembrete automático).
- [ ] P6.3 stage: toggle ligado em `suggest`, acompanhamento de taxa de aceite
      dos rascunhos por pelo menos uma semana de tráfego real, com o número
      separado por persona (tutor e clínica erram de formas diferentes) e por
      faixa de horário (dentro e fora do expediente).
- [ ] P6.4 produção: `suggest` primeiro. `auto` só depois, e só para a allowlist
      da RF-019, com decisão registrada no `verify.md`. Se a taxa de aceite
      divergir muito entre as personas, ligar `auto` só para a que estiver
      pronta — o modo é por conversa, então isso não exige mudança de código.
- [x] P6.5 métricas: contenção (respostas sem handoff), taxa de bloqueio do
      validador, custo por conversa, latência da primeira resposta — todas
      quebradas por persona e por dentro/fora do expediente, já que o bot
      atende 24/7. **Entregue 2026-08-23**:
      `whatsapp_bot_metrics_service.py` + `GET /whatsapp/bot/metricas`,
      somente leitura, sem migração. Distingue aceite limpo de aceite
      editado (o envio grava `positivo` mesmo com edição), exclui rascunho
      pendente do denominador, usa a janela da agenda para a faixa de
      horário e não apresenta custo quando a taxa não está configurada.
- Critério de conclusão: decisão de release documentada com números, não com
  impressão.
- Risco: ligar `auto` cedo demais. Mitigado por P6.3/P6.4 serem sequenciais e
  por a decisão exigir dado registrado.
- Rollback: desmarcar o toggle em Configurações — para tudo sem deploy.

## Plano de testes

- **Unitários (backend)**: migração; fila (dedupe, debounce, supersede, retry);
  portões (toggles, pausa, janela, tipo de mensagem); nono dígito; emergência;
  tools com escopo; validador de saída; tetos. Provider de LLM sempre fake.
- **Integração**: endpoint de mensagem recebida -> job -> worker -> decisão, com
  o serviço Node mockado por HTTP.
- **Frontend**: componente do painel de rascunho e do card de Configurações;
  `eslint`, `tsc --noEmit`, `next build`.
- **Manuais em stage**: preview somente leitura; conversa real em `suggest`;
  pedido de atendente; termo de emergência; número não cadastrado; mensagem de
  áudio; janela de 24h fechada.

## Dependências e bloqueios

- Respostas às perguntas abertas do `intent.md` (público da Fase 1, horário do
  modo `auto`, dono da revisão das transcrições).
- Confirmação em stage do comportamento real do nono dígito antes de fechar a
  Fase 3.
- Conteúdo institucional na base de conhecimento **para as duas personas**:
  tutor (horário, endereço, área de atendimento, como agendar, formas de
  contato) e clínica parceira (dias e área de atendimento, como solicitar
  exame, fluxo de laudo). Sem isso o bot não tem fonte e, por RF-020, não
  responde nada.
- Janela operacional da agenda preenchida e correta, inclusive exceções e
  feriados — é a fonte do "quando a equipe volta" nos handoffs fora do
  expediente (RF-033).
- `WHATSAPP_INTERNAL_API_TOKEN` já configurado nos dois lados (é o mesmo segredo
  usado hoje pelo push e pelas automações).

## Checklist para iniciar execução

- [ ] `intent.md` aprovado.
- [ ] `spec.md` aprovado.
- [ ] Perguntas abertas respondidas.
- [ ] Fases e rollback revisados.
- [ ] Ambiente de teste definido (local + stage antes de produção).
