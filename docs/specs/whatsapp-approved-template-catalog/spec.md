# Spec - whatsapp-approved-template-catalog

Data: 2026-10-15
Responsavel: Martiniano + Codex
Status: meta-approved-production-release-authorized

## 1) Requisitos funcionais

- RF-001: o servico mantem um catalogo tipado de modelos operacionais e uma nova variante
  de lembrete com servico aprovada na WABA de producao. O modelo anterior
  de quatro variaveis continua disponivel e preserva seu contrato.
- RF-002: cada entrada registra chave interna, nome Meta, ID operacional, corpo e ordem dos botoes.
- RF-003: o idioma de todos os modelos catalogados e `pt_BR`.
- RF-004: o gerador de payload rejeita quantidade divergente de variaveis de corpo.
- RF-005: o gerador de payload rejeita quantidade divergente de payloads de resposta rapida.
- RF-006: modelos sem botao, como `laudo_disponivel_portal`, geram somente o componente de corpo.
- RF-007: a mensagem persistida da reserva usa o mesmo texto aprovado na Meta.
- RF-008: o backend principal envia modelos aprovados ao servico WhatsApp por uma rota interna autenticada.
- RF-009: todo envio novo exige chave de idempotencia e persiste o resultado antes de permitir repeticao.
- RF-010: a Agenda oferece envio explicito de lembrete, alteracao, cancelamento e dados pendentes somente para estados compativeis.
- RF-011: o aviso de laudo so pode ser enviado depois da liberacao no Portal e para um WhatsApp cadastrado da clinica vinculada.
- RF-012: recibos de pagamento so podem ser enviados para OS `Pago` e o PDF pode representar uma ou
  mais OS do mesmo destinatario.
- RF-013: o lembrete de pagamento pode representar uma OS `Pendente` ou de duas a vinte OS
  `Pendente` do mesmo destinatario.
- RF-014: em atendimento domiciliar, recibo e cobranca usam os contatos cadastrados do tutor; em clinica parceira, usam os contatos da clinica.
- RF-015: cobrancas agrupadas usam um unico envio oficial e nao abrem uma mensagem manual por OS.
- RF-016: todo envio explicito registra auditoria sem persistir o numero completo nos detalhes.
- RF-017: recibos PDF usam upload de midia e cabecalho de documento, sem persistir o binario no
  servico WhatsApp.

## 2) Contratos documentados nesta feature

| Chave interna | Nome Meta | ID Meta | Variaveis | Respostas rapidas |
| --- | --- | --- | ---: | ---: |
| `reservation` | `reserva_de_agendamento` | `1850190569695780` | 5 | 2 |
| `appointmentReminder` | `lembrete_de_agendamento` | `2196951517539589` | 4 | 2 |
| `appointmentReminderService` | `lembrete_de_agendamento_servico_v2` | `1647759970059717` | 5 | 2 |
| `appointmentChange` | `alteracao_de_agendamento` | `1325207582741137` | 4 | 2 |
| `appointmentCancellation` | `cancelamento_de_agendamento` | `1072585772303343` | 4 | 2 |
| `appointmentMissingData` | `dados_pendentes_agendamento` | `2094851784715594` | 4 | 2 |
| `portalReportAvailable` | `laudo_disponivel_portal` | `1682393009502350` | 3 | 0 |
| `receiptAvailable` | `recibo_disponivel` | `934407008986859` | 4 | 1 |
| `pendingPaymentReminder` | `lembrete_pagamento_pendente_detalhado` | `1265598002271332` | 7 | 2 |
| `pendingPaymentReminderBulk` | `lembrete_pagamento_pendente_multiplas_os` | `1574210064240409` | 4 | 2 |
| `receiptPdf` | `recibo_pagamento_pdf` | `1025876410335393` | 7 + documento | 1 |
| `receiptPdfBulk` | `recibo_pagamento_pdf_multiplas_os` | `940165775772306` | 3 + documento | 1 |

## 3) Requisitos nao funcionais

- NFR-001 (fail closed): inconsistencias de variaveis ou botoes falham antes da requisicao externa.
- NFR-002 (privacidade): o catalogo contem apenas textos e IDs publicos; nao contem token, App Secret ou dados reais de clientes.
- NFR-003 (governanca): a aprovacao do modelo nao habilita automaticamente gatilhos de envio.
- NFR-004 (custo): novos envios iniciados pela empresa dependem de acao explicita ou automacao aprovada separadamente.
- NFR-005 (compatibilidade): o fluxo atual de reserva e sua configuracao por ambiente permanecem validos.
- NFR-006 (idempotencia): reutilizar uma chave com o mesmo conteudo retorna o envio anterior; conteudo divergente ou entrega ambigua exige revisao operacional.
- NFR-007 (destino): o usuario nao pode informar um telefone que nao esteja cadastrado no destinatario vinculado ao registro.
- NFR-008 (observabilidade): mensagens enviadas sao persistidas na conversa e associadas ao tipo e ID do objeto de dominio.
- NFR-009 (aprovacao): antes de ativar um novo contrato, exige-se aprovacao Meta
  verificada na conta do ambiente. A variante com servico exige ID numerico e
  `WHATSAPP_BUSINESS_ACCOUNT_ID=1369494994627980`; conta ausente/divergente
  bloqueia antes de banco/provedor. A WABA de stage nao possui essa aprovacao.
- NFR-010 (cutover): o modelo ativo de quatro variaveis nao e editado durante a aprovacao; o novo
  nome permite trocar o codigo sem interromper o snapshot atualmente publicado.

## 4) Fora de escopo

- agendamento automatico de lembretes;
- envio automatico ao liberar laudo, emitir recibo ou detectar pendencia;
- alteracao automatica de Agenda, Portal ou Financeiro pelas respostas dos sete novos modelos; as respostas continuam visiveis na caixa de entrada;
- modelo de autenticacao, que continua indisponivel para esta WABA;
- publicacao de outras funcionalidades em producao; a variante de lembrete foi
  autorizada para publicacao e ativacao em 15/10/2026.

## 5) Criterios de aceitacao

- CA-001: TypeScript compila em modo estrito.
- CA-002: teste cobre os contratos aprovados, a aprovacao por WABA e o idioma `pt_BR`.
- CA-003: teste prova payload sem botao e payload com dois botoes.
- CA-004: teste prova falha local para quantidade incorreta de variaveis.
- CA-005: teste existente de `reserva_de_agendamento` continua passando.
- CA-006: quality gate de stage executa o novo teste de catalogo.
- CA-007: o contrato interno generico exige autenticacao, tipo de objeto compativel, quantidade exata de variaveis e idempotencia.
- CA-008: Agenda, Portal e Financeiro exibem apenas acoes explicitas e respeitam os estados exigidos.
- CA-009: cobranca agrupada usa contrato proprio, exige o mesmo destinatario e referencia todas as OS.
- CA-010: validacoes Python, TypeScript, lint, build e SDD passam localmente.
- CA-011: recibos PDF exigem cabecalho de documento, upload de midia, idempotencia e referencias de
  uma ou mais OS.

## 6) Lembrete com servico — 2026-10-14

- RF-SERV01: `appointmentReminderService` preserva destinatario, paciente, data e
  hora nas quatro primeiras variaveis e acrescenta o nome completo do servico em
  `{{5}}`. Os botoes sao `Confirmar presenca` e `Solicitar alteracao`, com as acoes
  `confirmar_presenca` e `solicitar_alteracao`, respectivamente.
- RF-SERV02: a fonte e `Agendamento.servico_id -> Servico.nome`, com fallback para
  `Agendamento.servico` somente se o vinculo nao resolver ou o nome do catalogo
  estiver vazio apos normalizar espacos. Combos permanecem
  completos. Espacos sao normalizados; nome ausente ou acima de 300 caracteres
  bloqueia o modelo, sem truncamento ou inferencia por observacao, OS ou laudo.
- RF-SERV03: a previa pos-criacao da Agenda escolhe a variante e mostra o mesmo
  texto/ordem de parametros do envio oficial. A interface usa `Modelo de mensagem`
  e mantem o modelo anterior selecionavel. Servico ausente/invalido bloqueia
  copiar, abrir WhatsApp e enviar essa variante, com aviso visivel no modal.
- RF-SERV04: o nome na previa vem do servico selecionado no cadastro ou do
  agendamento salvo com o mesmo `servico_id`; nunca reaproveita um servico anterior
  depois de trocar a selecao.
- RF-SERV05: `Solicitar alteracao` cria pendencia interna preservando servico,
  status e horario; a equipe revisa qualquer inclusao de exame, consulta ou valor.
- NFR-SERV01: enquanto o ID Meta estiver pendente/invalido ou a WABA nao for a aprovada, o envio da variante
  retorna 409 antes de reservar entrega no banco ou chamar a Graph API. O envio
  direto usa a mesma validacao. Contratos antigos permanecem inalterados.
- NFR-SERV02: a automacao continua usando o modelo anterior enquanto
  `WHATSAPP_REMINDER_SERVICE_TEMPLATE_ENABLED=false`. Ativacao depende de aprovacao
  do novo modelo nos ambientes pertinentes e publicacao autorizada.
- NFR-SERV03: o novo lembrete exige status `Agendado` ou `Confirmado`, inclusive
  no envio manual. Com a flag ligada, preview e worker nao selecionam `Reservado`
  e nao consomem tentativas desses registros; reservas pendentes seguem seu fluxo
  proprio de confirmacao. Com a flag desligada o filtro legado e preservado.
- CA-SERV01: testes comprovam combo completo, fallback, nome ausente/invalido,
  precedencia de catalogo e preservacao das quatro variaveis legadas.
- CA-SERV02: testes provam zero acesso ao banco e zero chamadas Graph para a
  variante em WABA ausente/divergente; a conta aprovada valida o payload de cinco variaveis.
- CA-SERV03: testes de UI comprovam previa completa, mudanca de servico, fallback
  do registro salvo, estados compativeis e bloqueio visivel de nomes invalidos.

Texto submetido em 14/10/2026 (Utility, `pt_BR`, exemplos sinteticos):

> Olá, {{1}}. Lembramos que o atendimento de {{2}} está agendado para {{3}}, às {{4}}. Serviço agendado: {{5}}. Confira o serviço e o horário. Se precisar corrigir ou incluir outro serviço, toque em Solicitar alteração e envie o que deve ser ajustado.

Submissao autorizada em 14/10/2026 na WABA de producao
`1369494994627980`. Em 15/10/2026, o detalhe autenticado da Meta confirmou
ID `1647759970059717`, categoria Utilidade, `pt_BR` e status
`Ativo — Qualidade pendente`. O usuario autorizou publicar e ativar a variante.
A aprovacao fica limitada a essa WABA; stage continua bloqueado.
