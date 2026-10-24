## Dependências HTTP — 24/10/2026

O lockfile do backend Node deve usar `body-parser` 2.4.0 e `multer` 2.5.0 (mesma faixa major já permitida), com `qs` 6.16.1 exigido pelo parser. Correção das advisories GHSA-27r3-jxmh-p828 e GHSA-q7qp-rjg7-q26m detectadas pelo gate de publicação. Preservar rotas, autenticação, configurações, mensagens e isolamento dos ambientes. Nenhum envio real é necessário para validar a atualização.

# Spec - agenda-whatsapp-cloud-api

Data: 2026-08-14
Responsavel: Martiniano + Codex
Status: stage-br-phone-alias-fix

## 1) Requisitos funcionais

- RF-001: a tela pos-criacao de uma reserva oferece `Enviar pelo FortCordis` somente apos a API retornar o ID do agendamento.
- RF-002: o envio usa o modelo Meta `reserva_de_agendamento`, idioma `pt_BR`, com nome do destinatario, pet, data, hora e prazo.
- RF-003: o numero escolhido precisa pertencer ao cadastro da clinica ou do tutor selecionado.
- RF-004: o envio exige paciente e tutor vinculados; reservas incompletas continuam disponiveis pelo fluxo manual.
- RF-005: cada envio cria payloads aleatorios para `Confirmar` e `Solicitar alteracao`; o ID da reserva nao e exposto no botao.
- RF-006: `Confirmar` muda `Reservado` para `Confirmado` somente antes do prazo e com cadastro completo.
- RF-007: confirmacao atrasada muda o registro para `Expirado`, cria alerta critico e nunca reativa o slot.
- RF-008: `Solicitar alteracao` preserva data, hora e status e cria alerta interno para a equipe.
- RF-009: respostas repetidas com o mesmo `provider_message_id` retornam o resultado ja persistido.
- RF-010: o modal preserva `Abrir WhatsApp` e `Copiar mensagem` como alternativa manual.
- RF-011: mensagens de uma linha brasileira identificada pela Meta com ou sem o nono digito usam a mesma conversa interna.

## 2) Requisitos nao funcionais

- NFR-001 (seguranca): webhook exige `X-Hub-Signature-256`; integracao interna usa segredo compartilhado comparado em tempo constante.
- NFR-002 (minimo privilegio): a rota de envio exige usuario FortCordis autenticado; a rota de callback aceita somente a credencial interna.
- NFR-003 (privacidade): o modelo nao inclui diagnostico, laudo ou informacao clinica; logs nao registram tokens nem payloads aleatorios dos botoes.
- NFR-004 (idempotencia): o envio usa `idempotency_key` e o callback usa o ID de mensagem da Meta como chave unica.
- NFR-005 (integridade): remetente do clique deve ser o mesmo numero destinatario do envio; para numeros brasileiros, aceita-se somente a equivalencia exata causada pela inclusao ou omissao do nono digito depois de `55 + DDD`.
- NFR-006 (fail closed): envio que fica em estado ambiguo nao e repetido automaticamente; exige revisao operacional.
- NFR-007 (timezone): data e prazo exibidos usam UTC-3 independentemente do timezone do servidor.
- NFR-008 (deploy seguro): stage falha fechado se access token, App Secret, verify token ou IDs publicos Meta estiverem ausentes, com placeholder ou em formato inconsistente; logs exibem apenas o nome da variavel.
- NFR-009 (quality gate): o pipeline de stage compila e testa o servico WhatsApp, incluindo template, retry, autorizacao, redacao de logs e auditoria de dependencias, antes do deploy.
- NFR-010 (segredos por ambiente): o workflow injeta access token, App Secret e verify token somente no `.env` do servico WhatsApp de stage, a partir de GitHub Secrets dedicados, sem registrar valores nos logs.
- NFR-011 (versao Graph): o servico e o runtime de stage usam Graph API `v26.0`, alinhada a configuracao corrente do app FortZap.
- NFR-012 (cutover sem indisponibilidade): producao usa servico `fortcordis-whatsapp-backend` na porta local `3020`; stage permanece ativo ate o health e o smoke de producao passarem.
- NFR-013 (isolamento por ambiente): producao preserva e valida sua propria identidade Meta; stage usa app, WABA e numero de teste distintos e nenhum deploy copia configuracao Meta entre ambientes.
- NFR-014 (dependencias): o cliente HTTP Axios do servico WhatsApp deve usar uma versao sem alertas de seguranca conhecidos na auditoria das dependencias de producao; a atualizacao nao altera contratos da Graph API.

## 3) Contratos

### Backend principal

- `POST /api/v1/agenda/{agendamento_id}/whatsapp/reserva`
  - autenticacao FortCordis normal;
  - corpo: `destination`, `recipient_type`, `idempotency_key`;
  - valida status, prazo, vinculos e telefone; chama o servico WhatsApp.
- `POST /api/v1/integracoes/whatsapp/agenda/respostas`
  - header `X-FortCordis-WhatsApp-Token`;
  - corpo: IDs de mensagem inbound/outbound, agendamento, acao e remetente;
  - persiste resultado idempotente e aplica confirmacao/alerta.

### Servico WhatsApp

- `POST /automation/agenda/reservations`
  - header `X-WhatsApp-Internal-Token`;
  - envia template via `/{PHONE_NUMBER_ID}/messages`;
  - componentes: corpo com cinco textos e botoes quick reply nos indices `0` e `1`.
- `POST /webhook`
  - valida assinatura, WABA object, campo `messages` e `phone_number_id` configurado;
  - resolve o payload aleatorio, valida remetente e chama o backend principal.

## 4) Persistencia

- Core migration `20260811_66`: `whatsapp_agenda_respostas`, unica por `provider_message_id`.
- Node migration: `agenda_reservation_messages` e `agenda_reservation_button_events`.
- Mensagem outbound continua registrada em `messages`; status da Meta continua em `message_status_events`.
- Novas mensagens inbound e outbound usam uma chave interna canonica para unificar as variantes brasileiras com e sem nono digito; o numero original continua preservado no payload do webhook e no envio Graph.

## 5) Configuracao

- Core: `WHATSAPP_AGENDA_ENABLED`, `WHATSAPP_AGENDA_SERVICE_URL`, `WHATSAPP_AGENDA_INTERNAL_TOKEN`.
- Node: `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_INTERNAL_API_TOKEN`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_RESERVATION_TEMPLATE_NAME`, `WHATSAPP_RESERVATION_TEMPLATE_LANGUAGE`.
- IDs publicos documentados nesta feature correspondem somente a producao; stage deve usar identidade Meta distinta.
- Segredos nunca sao armazenados em Git, documentacao ou mensagens de suporte.
- Em stage, os segredos de CI sao `WHATSAPP_ACCESS_TOKEN_STAGE`, `WHATSAPP_APP_SECRET_STAGE` e `WHATSAPP_VERIFY_TOKEN_STAGE`; os IDs publicos usam as GitHub Variables `WHATSAPP_PHONE_NUMBER_ID_STAGE`, `WHATSAPP_META_APP_ID_STAGE` e `WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE`.
- Em producao, o runtime usa `/var/www/fortcordis-v2/whatsapp-stage-backend/.env`, porta `3020` e o backend principal `http://127.0.0.1:8000`; o callback publico e `https://app.fortcordis.com.br/whatsapp/webhook`.
- Quando o banco de producao apresenta certificado autoassinado e a URL exige `sslmode=require`, `DATABASE_SSL_REJECT_UNAUTHORIZED=false` mantem TLS ativo apenas para o cliente PostgreSQL do servico WhatsApp e desativa a validacao da cadeia somente nesse cliente; certificados explicitos nao podem ser sobrescritos.
- A Meta nao oferece suporte a configuracao de Webhooks do WhatsApp pela borda `/{app-id}/subscriptions`; depois do health e smoke de producao, a troca de callback deve ser feita no Painel do App, mantendo `messages` inscrito e sem expor o verify token.
- O token interno core -> WhatsApp e gerado/preservado separadamente em producao; ele nao e copiado de stage.

## 6) Criterios de aceitacao

- CA-001: o payload Graph usa modelo/idioma corretos, cinco variaveis e dois quick replies.
- CA-002: repetir a mesma chave de envio retorna o mesmo `message_id`; conteudo diferente com a mesma chave falha.
- CA-003: confirmar reserva ativa e completa resulta em `Confirmado` com origem `WhatsApp Fort Cordis`.
- CA-004: repetir o callback nao cria segunda alteracao nem segundo alerta.
- CA-005: confirmacao apos prazo resulta em `Expirado` e alerta critico.
- CA-006: solicitar alteracao cria alerta e mantem o horario reservado.
- CA-007: telefone nao cadastrado e remetente divergente sao rejeitados.
- CA-008: TypeScript, lint, testes focados, migracoes e preflight passam antes de habilitar o webhook na Meta.
- CA-009: um App Secret legado gerado como placeholder ou um access token incompleto interrompem o deploy antes de reiniciar o servico.
- CA-010: o workflow de stage nao executa o deploy se qualquer teste obrigatorio do servico WhatsApp falhar.
- CA-011: o workflow de stage falha antes do deploy se qualquer segredo Meta estiver ausente ou fora do formato esperado e, quando valido, atualiza o `.env` remoto com permissao `0600`.
- CA-012: chamadas Graph do servico usam `v26.0` quando o ambiente nao define outra versao valida.
- CA-013: `5585988018899` e `558588018899` sao aceitos como a mesma identidade; mudanca no DDD ou no restante do numero permanece rejeitada.
- CA-014: novas mensagens enviadas e recebidas pelas duas variantes brasileiras sao vinculadas a mesma chave de conversa.
- CA-015: o deploy de producao falha fechado se sua configuracao Meta protegida estiver ausente ou divergente e nunca usa o `.env` de stage como fonte.
- CA-016: `/whatsapp/health` responde `200` em producao e o smoke assinado/autenticado passa antes da alteracao na Meta.
- CA-017: o workflow de producao executa `scripts/deploy_prod_vps.sh` a partir do snapshot de `origin/main` que sera publicado, mantendo o checkout anterior intacto ate o proprio script registrar o hash de rollback.
- CA-018: a excecao para certificado autoassinado e explicita, limitada ao PostgreSQL do runtime de producao, exige `sslmode=require`, preserva TLS e falha fechado para valores invalidos, conexao sem TLS ou certificados configurados explicitamente.
- CA-019: a troca manual no Painel da Meta ocorre apenas depois do deploy aprovado, usa o verify token protegido e confirma que a URL de producao e o campo `messages` permanecem ativos.
- CA-020: o build e o teste de retry do servico WhatsApp passam com a versao atualizada do Axios, e `npm audit --omit=dev` nao encontra vulnerabilidades.

## 7) Fora de escopo

- campanhas de marketing;
- envio de laudos, diagnosticos ou midia;
- alteracao automatica de data/hora solicitada pelo cliente;
- reativacao automatica de reserva expirada;
- uso do WhatsApp Business App simultaneamente no mesmo numero sem coexistencia aprovada pela Meta.

## Presença pelo lembrete — 2026-10-14

- RF-PRES01: `confirmar_presenca` é uma ação distinta de `confirmar`. O
  appointmentReminder aceita o clique somente pelo vínculo persistido de
  template enviado e pelo remetente equivalente ao destinatário.
- RF-PRES02: a API interna registra `presenca_confirmada` somente para
  agendamento em Agendado ou Confirmado, preservando todas as colunas de agenda,
  horário, status e autoria. Trata-se de intenção de presença, não de atendimento
  realizado ou confirmação operacional de uma reserva.
- RF-PRES03: outros estados seguem revisão manual com alerta; uma presença
  recebida não expira, reativa, cancela ou formaliza reserva. Agendamento ausente
  tem resultado seguro. A repetição do provider_message_id retorna o recibo
  original e não gera novo evento de agenda.
- RF-PRES04: após resposta de API compatível com ação e agendamento vinculados,
  o Node persiste `messages.metadata.agenda_receipt` com source/action/result/status
  exatos. Somente presença e confirmação de reserva bem-sucedidas são marcadas;
  resultados incertos, rejeitados, ignorados ou pendentes permanecem sem recibo.
- RF-PRES05: nenhum segredo, callback, template ou flag é alterado. A adição
  usa tabelas existentes e dispensa migração. Reverter código preserva recibos,
  histórico e agenda; serviços antigos podem ignorar o novo metadata.

## Serviço no lembrete — 2026-10-14

- RF-SERV01: a variante explicita `appointmentReminderService` usa o novo nome
  Meta `lembrete_de_agendamento_servico_v2`, preserva as quatro variaveis do
  lembrete anterior e acrescenta o servico completo vinculado ao agendamento.
  Nome ausente/acima de 300 caracteres bloqueia o envio sem truncamento.
  A variante exige Agendado/Confirmado, nunca confirma uma reserva pendente.
- RF-SERV02: a previa pos-criacao mostra o nome do catalogo selecionado ou o
  literal do agendamento salvo com o mesmo ID de servico. Combos permanecem
  completos; a selecao anterior nunca e reaproveitada por engano.
- RF-SERV03: os botoes das duas versoes de lembrete usam o mesmo vinculo
  persistido e validacao de remetente. `Confirmar presenca` registra apenas
  presenca. `Solicitar alteracao` cria revisao humana, sem mudar servico/agenda.
- NFR-SERV01: a variante com ID invalido ou WABA ausente/divergente da aprovada
  (`1369494994627980`) falha com 409 antes de reserva no banco ou chamada Graph. O modelo antigo permanece com quatro variaveis e a flag da
  variante automatica fica desligada ate aprovacao/publicacao autorizadas.
- CA-SERV01: fontes, combo, fallback, limite, preview, contrato API e cinco
  parametros oficiais passam em testes locais; a variante pendente nao faz
  nenhum envio real. O formulario Meta preparado usa apenas dados sinteticos.

## Confirmacao automatica do pedido de alteracao — 2026-10-16

- RF-ACK01: apos `Solicitar alteracao` em lembrete vinculado, somente a resposta
  confiavel `alteracao_solicitada` da API interna autoriza uma mensagem curta ao
  destinatario, informando que o pedido foi recebido e sera analisado pela
  equipe. O texto nao afirma que servico, horario ou valor ja foram alterados.
- RF-ACK02: a confirmacao automatica aparece no historico com
  `metadata.source='approved_template_button.solicitar_alteracao_ack'` e origem
  automatica. Mesmo quando enviada com sucesso, nao substitui a resposta da
  equipe: a conversa permanece em `needs_reply=true` e o alerta interno segue
  disponivel para revisao humana.
- NFR-ACK01: reentrega do mesmo clique nao gera outra confirmacao. Remetente
  divergente, botao sem vinculo e resposta de dominio diferente de
  `alteracao_solicitada` nao autorizam envio. Falha de envio permanece visivel
  no historico sem modificar agendamento ou marcar a revisao como resolvida.
- NFR-ACK02: o envio so ocorre apos o commit do webhook, dentro da janela de
  atendimento de 24 horas aberta pelo clique, com uma tentativa Graph e chave
  unica por mensagem de clique. Reinicio antes da reserva recupera a intencao;
  reserva pendente por mais de cinco minutos vira falha para revisao, sem
  reenvio automatico de resultado incerto. Uma resposta humana ja enviada
  depois do clique dispensa a confirmacao tardia.
- NFR-ACK03: a busca periodica usa indices parciais nos eventos processados de
  alteracao e nas mensagens de saida pendentes, e encerra candidatos inelegiveis;
  eventos anteriores sem intencao
  explicita nao recebem mensagem retroativa. O bot reconhece o pedido ja
  alertado pela Agenda e evita um segundo handoff generico.
- NFR-ACK04: ao encerrar o processo, o worker espera o envio em andamento
  terminar antes de fechar o banco e nao inicia outro candidato.
- CA-ACK01: webhook sintetico comprova um envio para a alteracao valida e
  nenhum envio nos caminhos rejeitados ou repetidos.
- CA-ACK02: apos a confirmacao automatica enviada, a conversa continua na fila
  `needs_reply`; uma resposta humana posterior segue o comportamento normal de
  resolucao da pendencia.
- CA-ACK03: falha da Graph, reserva interrompida, janela vencida, resposta
  humana previa e mais de cinquenta eventos antigos nao causam reenvio ou
  bloqueio de um clique novo valido.
- CA-ACK04: encerramento durante um envio espera o resultado e preserva o
  estado final da mensagem no historico.
