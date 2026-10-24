## Correção das dependências HTTP — 24/10/2026

Reproduzido bloqueio de `npm audit --omit=dev` no workflow de stage 40104243770, antes de qualquer instalação. Atualizar somente o lockfile, sem alteração de API ou destino Meta. Validar build TypeScript, Express HTTP, upload/anexos e redação de logs com transportes simulados; repetir o gate completo e exigir auditoria de dependências de produção sem vulnerabilidades. Não contornar o gate nem executar envios reais. Local: build, Express HTTP, anexos e redação de logs aprovados; `npm audit --omit=dev` retorna zero vulnerabilidades. A dependência de desenvolvimento não entra no runtime de produção.

# Verify - agenda-whatsapp-cloud-api

Data: 2026-08-14
Responsavel: Martiniano + Codex
Status: production-cutover-in-progress

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test-reservation-template.ts` inspeciona modelo, idioma, cinco textos e dois quick replies | passou |
| CA-002 | constraints e estado de `agenda_reservation_messages`; envio ambiguo falha fechado | leitura + build passaram |
| CA-003/CA-004 | `test_confirm_is_idempotent_and_updates_active_reservation` | passou |
| CA-005 | `test_late_confirmation_does_not_reactivate_and_creates_alert` | passou |
| CA-006 | `test_change_request_keeps_schedule_and_creates_staff_alert` | passou |
| CA-007 | validacao de destino no core e de remetente no webhook | leitura + tipos passaram |
| CA-008 | rotas importadas, Node compilado, frontend TypeScript/ESLint/build | passou |
| CA-009 | `deploy_prod_vps.sh` e preflight validam formato dos segredos sem registrar seus valores | passou por inspecao + sintaxe |
| CA-010 | `deploy-stage.yml` instala, compila, testa e audita `whatsapp-stage-backend` no quality gate | passou no run `31652774238` |
| CA-011 | workflow valida e transmite por stdin os tres GitHub Secrets de stage, atualiza o `.env` remoto e aplica `0600` sem imprimir valores | passou no run `31652774238` |
| CA-012 | fallback do cliente Graph e default do deploy usam `v26.0` | passou no deploy e no callback real de stage |
| CA-013 | `test-phone-number.ts` cobre equivalencia com/sem nono digito e rejeita DDD/sufixo diferentes | passou localmente |
| CA-014 | controllers inbound/outbound usam `canonicalWhatsAppIdentity` como chave de conversa | build + inspecao passaram localmente |
| CA-015 | workflow de producao preserva o `.env` do proprio runtime, valida IDs esperados e nao usa mais o arquivo de stage | passou na producao no run `32077347457`, com health e smoke concluídos |
| CA-016 | runtime exclusivo na porta `3020`, health publico e smoke autenticado/assinado | passou em producao |
| CA-017 | workflow busca e executa o script de deploy diretamente do snapshot remoto, sem depender da copia antiga presente no checkout do VPS | passou por inspecao + parse YAML |
| CA-018 | `test-database-config.ts` cobre padrao seguro, excecao TLS escopada e recusas; deploy valida o booleano antes de gravar o ambiente | passou localmente |
| CA-019 | Painel do App e obrigatorio para Webhooks do WhatsApp; callback de producao e `messages` foram conferidos visualmente | passou |
| CA-020 | Axios 1.20.0: `npm run build`, `npm run test:whatsapp-retry` e `npm audit --omit=dev` | passou localmente e no quality gate de stage `36753995294` em 30/09/2026 |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:reservation-template
cd whatsapp-stage-backend && npm run test:database-config
cd whatsapp-stage-backend && npm run test:phone-number
cd whatsapp-stage-backend && npm run test:whatsapp-retry
cd whatsapp-stage-backend && npm run test:auth-policy
cd whatsapp-stage-backend && npm run test:log-redaction
cd whatsapp-stage-backend && npm audit --omit=dev
cd backend && backend/venv/bin/python -m unittest tests.test_whatsapp_agenda_service
cd backend && backend/venv/bin/python -m compileall -q app tests/test_whatsapp_agenda_service.py
cd backend && TZ=UTC backend/venv/bin/python -m unittest discover -s tests -p "test_*.py"
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
bash scripts/whatsapp_stage_preflight.sh  # fixtures valida e invalida, sem servicos/HTTP
bash -n scripts/deploy_prod_vps.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy.yml")'
```

## Resultados atuais

- Node/TypeScript: compilou.
- Payload do template: passou.
- Identidade telefonica: equivalencia brasileira restrita passou; DDD, sufixo e numeros internacionais distintos continuaram rejeitados.
- Retry da Graph API: passou.
- Auditoria de dependencias do servico WhatsApp: 0 vulnerabilidades apos atualizar Axios/Express.
- Backend focado: 6 testes de servico/contrato passaram; migracao e ciclo de migracao tambem passaram.
- Suite backend completa com `TZ=UTC`: 718 testes passaram novamente em 14/08/2026.
- Importacao das duas novas rotas FastAPI: passou.
- Frontend TypeScript e ESLint: passaram sem erros ou avisos.
- Build Next.js 15.5.14: passou, com 43 paginas estaticas geradas.
- Scripts de deploy/preflight: `bash -n` passou.
- Preflight com fixture completa passou; fixture com App Secret placeholder foi recusada sem expor valores.
- Quality gate de stage agora cobre build, template, retry, autorizacao, redacao de logs e auditoria do servico WhatsApp.
- `git diff --check`: passou.
- GitHub Secrets de stage cadastrados sem exposicao: `WHATSAPP_ACCESS_TOKEN_STAGE`, `WHATSAPP_APP_SECRET_STAGE` e `WHATSAPP_VERIFY_TOKEN_STAGE`.
- App FortZap usa configuracao de webhook Graph API `v26.0`; defaults do servico e do deploy foram alinhados.
- Deploy de stage `31652774238` e Migration CI `31652774196` terminaram com sucesso no commit `95d94a69`.
- O smoke executado no VPS validou verificacao GET, rejeicao de assinatura invalida, idempotencia de payload duplicado, concorrencia de mensagens, retry da Graph API e canario autenticado.
- Callback HTTPS `https://app.stage.fortcordis.com.br/whatsapp/webhook` aceitou a verificacao com o token real e devolveu o challenge esperado; token incorreto retornou `403`.
- O campo `messages` esta inscrito no app e a assinatura de webhooks da WABA `1369494994627980` foi ativada.
- Health check do servico retornou `200`; `/whatsapp/agents` anonimo retornou `401`.
- O app Meta `975334532125008` foi publicado e esta disponivel ao publico.
- O template `reserva_de_agendamento` em `pt_BR`, com cinco variaveis e os quick replies `Confirmar` e `Solicitar alteracao`, foi criado na WABA correta com ID `1850190569695780` e aparece como ativo no WhatsApp Manager.
- O primeiro teste real enviou para `5585988018899`, mas a Meta devolveu o clique de botao como `558588018899`; a comparacao literal rejeitou o evento e manteve a reserva como `Reservado`.
- A correcao local agora usa a representacao sem o nono digito apenas como chave interna e para auditoria do callback; o numero original continua sendo enviado para a Graph API.
- Em 17/08/2026, o usuario confirmou que o teste real de confirmacao alterou corretamente o status no FortCordis e que os modelos necessarios aparecem aprovados e ativos na WABA Fort Cordis.
- O callback Meta ainda apontava para `https://app.stage.fortcordis.com.br/whatsapp/webhook`; a troca para producao deve ocorrer somente depois do novo runtime responder `200` e concluir o smoke.
- A primeira promocao de producao (`32073647259`) falhou fechada porque o checkout do VPS ainda carregou a versao anterior do proprio script antes do `git reset`; o rollback automatico restaurou `3ecf5ee`. O workflow agora materializa o script diretamente de `origin/main`, preservando o checkout anterior para que esse script ainda possa registrar e restaurar o hash correto.
- A segunda promocao (`32075595566`) carregou o script correto, sincronizou e validou as credenciais, mas falhou fechada na migracao Node porque o PostgreSQL de producao apresenta cadeia autoassinada. A configuracao agora mantem TLS com `sslmode=require` e limita a excecao de validacao ao cliente PostgreSQL deste runtime.
- A terceira promocao (`32077347457`) concluiu o deploy de producao no commit `ed9f257`, incluindo migracao Node, health, smoke assinado/autenticado e canario; o health publico respondeu `200` e as rotas privadas anonimas responderam `401`.
- A tentativa `32079135104` tambem concluiu o deploy no commit `8c566d7`, mas a etapa posterior de callback recebeu HTTP `400`/Meta `100`. A documentacao oficial confirma que `/{app-id}/subscriptions` nao suporta Webhooks do WhatsApp; a automacao incompatível foi removida e o corte permanece restrito ao Painel do App.

## Pendencias para nova prova real

- publicar este snapshot em stage e aguardar os workflows terminais;
- criar uma nova reserva controlada, enviar o template e clicar em `Confirmar` antes do prazo;
- comprovar no FortCordis que o status mudou para `Confirmado` e que as novas mensagens ficaram na mesma conversa;
- testar `Solicitar alteracao` em outra reserva controlada e comprovar o alerta interno antes de qualquer promocao para producao.

## Validação local — presença no lembrete 2026-10-14

`test_whatsapp_agenda_presence.py` valida presença nos estados Agendado e
Confirmado preservando o snapshot de todas as colunas da agenda, sem consultas
de paciente/tutor; estados finais ou reserva vigente/vencida continuam revisão
manual; registro inexistente permanece seguro. API real simulada valida token
interno/401, ação desconhecida/422, recibo idempotente e notificação uma vez.

O Node valida binding enviado, remetente e ação/agendamento retornados pela API
antes de carimbar receipt. Testes de webhook assinado usam banco PostgreSQL local
descartável e transportes simulados. A prova de produção exige novo clique após
publicação autorizada; os cliques antigos ignorados não foram alterados.

## Servico no lembrete — validacao local 2026-10-14

`test_whatsapp_agenda_reminder_service.py` valida fonte pelo catalogo,
fallback do registro, combo completo, nome invalido/ausente, contrato HTTP e
cinco parametros sem alterar as quatro variaveis do lembrete anterior.
O callback sintetico de alteracao preserva todas as colunas do agendamento,
cria alerta para servico/horario e nao duplica esse alerta no replay.

Os testes do modal validam selecao atual do servico, fallback pos-salvamento
com ID compativel, previa completa e bloqueio visivel no modal. Node valida
os dois botoes via binding persistido/remetente e bloqueia a variante pendente
antes de banco/Graph. Corpo preparado no formulario da Meta coincide com o
codigo. Em 14/10/2026, apos autorizacao explicita, o modelo foi submetido na
WABA de producao `1369494994627980`: ID `1647759970059717`, Utilidade/pt_BR,
status `Em analise`. Nenhuma mensagem foi enviada a uma clinica; aprovacao,
ativacao e publicacao continuam pendentes. Detalhes e screenshot na verificacao
de `whatsapp-approved-template-catalog`.


## Aprovacao e preparacao da ativacao — 2026-10-15

- Detalhe autenticado da Meta confirmou `lembrete_de_agendamento_servico_v2`,
  ID `1647759970059717`, Utilidade / Portuguese (BR), status
  `Ativo — Qualidade pendente`. Corpo de cinco variaveis e dois botoes conferidos.
  Prova local: `/tmp/fortcordis-lembrete-servico-meta-aprovado.png`.
- Usuario autorizou expressamente publicar e ativar a variante em producao.
  A WABA `1369494994627980` e a unica aprovada; a WABA de stage
  `4413513738886247` permanece bloqueada. Nenhuma credencial/identidade Meta mudou.
- Node exige ID numerico e WABA exata, com rejeicao antes de banco/Graph.
  Build, TypeScript, catalogo e inbox passaram; os testes de conta ausente/
  divergente comprovam zero conexao e zero envio, com legado preservado.
- Nenhuma mensagem de teste foi enviada nem marcador de lembrete foi limpo.
  A publicacao e a ativacao ainda dependem da conclusao dos gates de release.

## Confirmacao automatica do pedido de alteracao — validacao local 2026-10-16

| Criterio | Evidencia | Estado |
| --- | --- | --- |
| CA-ACK01 | `test-change-request-acknowledgement.ts`: webhook assinado gera uma confirmacao apos commit; repeticao do payload/clique, remetente divergente, callback falho, resultado diferente e janela vencida nao geram envio adicional. `test-conversation-reply-queue.ts` mantem botao desconhecido sem recibo confiavel | passou |
| CA-ACK02 | PostgreSQL isolado: confirmacao enviada com `metadata.source='approved_template_button.solicitar_alteracao_ack'` e `origem='bot'` mantem `needs_reply=true`; resposta humana posterior encerra a pendencia | passou |
| CA-ACK03 | Teste cobre falha Graph sem reenvio, reserva vencida marcada `failed`, mais de 50 eventos expirados antes de clique valido, resposta humana antecipada e retry humano com ID antigo | passou |
| CA-ACK04 | Teste segura a resposta Graph durante o encerramento do worker; o encerramento aguarda o resultado e a mensagem termina como `sent` | passou |

`npm run migrate` aplicou os dois indices parciais no PostgreSQL local; `npm run build`,
`test:change-request-acknowledgement`, `test:conversation-reply-queue`,
`test:approved-templates`, `test:customer-service-window` e o teste de eventos
de botoes passaram. Os 36 testes Python focados de recibos, fila do bot e
lembrete passaram. `python3 -m unittest backend.tests.test_sdd_guardrail`,
parse YAML dos workflows e `git diff --check` passaram. O teste usou apenas
destinos e transporte Graph sinteticos; esta mudanca ainda nao foi publicada
nem gerou mensagem real.
