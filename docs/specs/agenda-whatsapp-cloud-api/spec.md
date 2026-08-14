# Spec - agenda-whatsapp-cloud-api

Data: 2026-08-14
Responsavel: Martiniano + Codex
Status: copy-update-pending-meta-review

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
- RF-012: o corpo informa explicitamente: `Apos esse prazo, o horario podera ser disponibilizado para outros clientes automaticamente.`

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
- IDs publicos esperados para esta conta: App `975334532125008`, WABA `1369494994627980`, telefone `1279142515283484`.
- Segredos nunca sao armazenados em Git, documentacao ou mensagens de suporte.
- Em stage, os nomes dos segredos de CI sao `WHATSAPP_ACCESS_TOKEN_STAGE`, `WHATSAPP_APP_SECRET_STAGE` e `WHATSAPP_VERIFY_TOKEN_STAGE`; somente os nomes podem aparecer em logs e documentacao.

## 6) Criterios de aceitacao

- CA-001: o payload Graph usa modelo/idioma corretos, cinco variaveis e dois quick replies; o corpo renderizado preserva acentos e termina com o aviso de disponibilizacao automatica para outros clientes.
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

## 7) Fora de escopo

- campanhas de marketing;
- envio de laudos, diagnosticos ou midia;
- alteracao automatica de data/hora solicitada pelo cliente;
- reativacao automatica de reserva expirada;
- uso do WhatsApp Business App simultaneamente no mesmo numero sem coexistencia aprovada pela Meta.
