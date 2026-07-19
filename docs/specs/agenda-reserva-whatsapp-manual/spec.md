# Spec - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: approved

## 1) Escopo funcional

Ao criar uma reserva ou um agendamento, a secretaria escolhe clinica ou tutor como destinatario. Depois que a API confirmar a criacao, o frontend mostra a mensagem pronta, permite copia-la e abre o WhatsApp escolhido. Reservas usam prazo padrao de tres horas e, quando vencidas, deixam de bloquear a agenda.

## 2) Requisitos funcionais (RF)

- RF-001: o fluxo de mensagem deve aparecer na criacao de reservas e agendamentos comuns.
- RF-002: a secretaria deve escolher `clinica` ou `tutor` conforme os cadastros disponiveis.
- RF-003: reservas devem iniciar com prazo de confirmacao de tres horas; o prazo deve ser futuro e anterior ao atendimento.
- RF-004: a mensagem deve seguir o modelo operacional com titulo, medico veterinario, atendimento, data, horario, paciente, tutor, especialista e clinica.
- RF-005: paciente/tutor cadastrados devem aparecer com seus nomes; paciente inclui o ID. Dados ausentes devem aparecer como `Pendente`.
- RF-006: a mensagem de reserva deve informar o prazo e que o horario voltara a ficar disponivel sem confirmacao.
- RF-007: a mensagem de agendamento deve informar que o horario solicitado foi agendado.
- RF-008: apos salvar, a operacao deve conseguir copiar a mensagem ou abrir `wa.me` com texto preenchido.
- RF-009: a clinica deve aceitar ate dez numeros de WhatsApp, sem duplicatas, mantendo o campo de telefone geral.
- RF-010: quando houver mais de um WhatsApp da clinica, a tela pos-criacao deve permitir escolher o numero de destino.
- RF-011: telefone ausente nao bloqueia a criacao; o WhatsApp abre sem destinatario predefinido.
- RF-012: prazo e destinatario da reserva devem permanecer nas observacoes para rastreabilidade.
- RF-013: uma reserva sem paciente deve persistir `paciente_id=NULL`.
- RF-014: ao atingir `reserva_expira_em`, a reserva muda para `Expirado`, deixa de bloquear sugestoes/slots e nao pode ser reativada silenciosamente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): o telefone geral da clinica permanece disponivel e serve de fallback para cadastros antigos.
- NFR-002 (privacidade): a mensagem nao inclui diagnostico, exame ou dados clinicos.
- NFR-003 (ux): o envio continua manual e depende de clique explicito.
- NFR-004 (integridade): a expiracao deve liberar a exclusao PostgreSQL sem permitir sobreposicao de slots ativos.

## 4) Contratos tecnicos

### API de clinicas

- `POST/PUT/GET /api/v1/clinicas`: campo `whatsapps: string[]` normalizado, sem duplicatas e limitado a dez itens.
- Respostas antigas sem lista usam `telefone` como fallback.

### API de agenda

- `POST/PUT /api/v1/agenda`: campo opcional `reserva_expira_em`.
- Respostas incluem `reserva_expira_em` e podem retornar status `Expirado`.
- Escritas e consultas operacionais normalizam reservas vencidas antes de calcular disponibilidade.

### Banco/migracoes

- `20260719_50`: adiciona `clinicas.whatsapps` em JSON/JSONB e aproveita o telefone existente.
- `20260719_51`: adiciona `agendamentos.reserva_expira_em`.
- A constraint `ex_agendamentos_slot_ativo` continua protegendo apenas os status ativos; `Expirado` nao participa.

### Frontend

- Cadastro e edicao de clinica recebem lista dinamica de WhatsApps.
- Modal da agenda prepara mensagem para reserva ou agendamento.
- A tela pos-criacao oferece seletor quando a clinica tem multiplos numeros.
- Agenda e FullCalendar tratam `Expirado` como status nao bloqueante.

## 5) Compatibilidade e rollout

- Clinicas antigas continuam com o telefone existente como primeiro destino.
- Reservas antigas sem `reserva_expira_em` continuam validas ate acao manual.
- Rollback exige reverter codigo; as novas colunas podem permanecer sem uso.

## 6) Criterios de aceitacao (CA)

- CA-001: marcar reserva preenche prazo com tres horas a partir do momento atual.
- CA-002: prazo passado ou posterior/igual ao atendimento impede salvar.
- CA-003: mensagem de reserva segue o modelo e usa `Pendente` para tutor/paciente ausentes.
- CA-004: mensagem de agendamento informa que o horario solicitado foi agendado.
- CA-005: `Abrir WhatsApp` usa telefone normalizado com DDI 55 e texto codificado.
- CA-006: clinica salva, lista e atualiza multiplos WhatsApps sem duplicatas.
- CA-007: mais de um numero produz seletor antes de abrir o WhatsApp.
- CA-008: ausencia de numero permite escolher contato manualmente.
- CA-009: reserva sem paciente persiste `NULL` e respeita `fk_agenda_paciente`.
- CA-010: reserva vencida passa a `Expirado` e um novo registro pode ocupar o mesmo slot.

## 7) Casos de borda

- CB-001: reserva sem tutor permite somente clinica quando houver clinica selecionada.
- CB-002: atendimento domiciliar permite somente tutor.
- CB-003: horario iniciado em menos de tres horas exige ajuste do prazo para um instante anterior ao atendimento.
- CB-004: falha de clipboard nao desfaz o registro criado.
- CB-005: reserva `Expirado` nao pode ser confirmada/reativada; a operacao cria novo agendamento.

## 8) Fora de escopo

- Envio automatico pela Meta.
- Processamento de respostas do WhatsApp.
- Configuracao multiprofissional do nome/especialidade exibidos na mensagem.
