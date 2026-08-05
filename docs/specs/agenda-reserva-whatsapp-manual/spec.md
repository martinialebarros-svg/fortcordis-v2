# Spec - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: approved

## 1) Escopo funcional

Ao criar uma reserva ou um agendamento, a secretaria escolhe clinica ou tutor como destinatario. Depois que a API confirmar a criacao, o frontend mostra a mensagem pronta, permite copia-la e abre o WhatsApp escolhido. Reservas usam prazo padrao de tres horas e, quando vencidas, deixam de bloquear a agenda.

## 2) Requisitos funcionais (RF)

- RF-001: o fluxo de mensagem deve aparecer na criacao de reservas e agendamentos comuns.
- RF-002: a secretaria deve escolher `clinica` ou `tutor` conforme os cadastros disponiveis.
- RF-003: reservas devem iniciar com prazo de confirmacao de tres horas; a secretaria pode ajustar o prazo entre meia hora e 72 horas antes de salvar, e o vencimento deve permanecer futuro e anterior ao atendimento.
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
- RF-015: a tela de novo agendamento deve permitir incluir ou editar o WhatsApp do destinatario selecionado sem sair do fluxo.
- RF-016: a edicao rapida deve persistir no cadastro correspondente; clinicas aceitam ate dez numeros e tutores atualizam seu WhatsApp principal.
- RF-017: reservas com ate 60 minutos restantes devem aparecer em alerta destacado na agenda, com contagem regressiva atualizada; nos 15 minutos finais o alerta deve assumir estado critico.
- RF-018: o alerta deve orientar explicitamente a secretaria a reforcar com a clinica o envio dos dados do tutor e do pet antes do vencimento.
- RF-019: ao tentar ocupar um slot que contenha uma reserva expirada, a API deve exigir confirmacao explicita de que a secretaria revisou as mensagens do WhatsApp.
- RF-020: a confirmacao deve exibir o contexto conhecido da reserva expirada e oferecer as acoes `Voltar e verificar WhatsApp` e `Revisei as mensagens e quero agendar`.
- RF-021: a confirmacao de revisao deve ser registrada na auditoria com os IDs das reservas expiradas encontradas.
- RF-022: se o mesmo cliente confirmar depois do vencimento, a secretaria deve poder alterar `Expirado` para `Agendado` mediante confirmacao tardia explicita, desde que o slot continue livre e os dados obrigatorios estejam preenchidos.
- RF-023: a confirmacao tardia deve ficar disponivel na Agenda e no FullCalendar com rotulo proprio, sem reativar silenciosamente a reserva.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): o telefone geral da clinica permanece disponivel e serve de fallback para cadastros antigos.
- NFR-002 (privacidade): a mensagem nao inclui diagnostico, exame ou dados clinicos.
- NFR-003 (ux): o envio continua manual e depende de clique explicito.
- NFR-004 (integridade): a expiracao deve liberar a exclusao PostgreSQL sem permitir sobreposicao de slots ativos.
- NFR-005 (timezone): a comparacao de vencimento deve usar o horario operacional UTC-3, independentemente do timezone do runner ou servidor.
- NFR-006 (integridade): confirmar a revisao de uma reserva expirada nunca pode contornar bloqueios administrativos ou a sobreposicao com outro agendamento ativo.

## 4) Contratos tecnicos

### API de clinicas

- `POST/PUT/GET /api/v1/clinicas`: campo `whatsapps: string[]` normalizado, sem duplicatas e limitado a dez itens.
- `PUT /api/v1/clinicas/{clinica_id}/whatsapps`: atualiza somente a lista de WhatsApps, sem sobrescrever os demais dados cadastrais.
- Respostas antigas sem lista usam `telefone` como fallback.

### API de agenda

- `POST/PUT /api/v1/agenda`: campo opcional `reserva_expira_em`.
- `POST/PUT /api/v1/agenda`: campo transitorio `confirmar_slot_reserva_expirada`, que autoriza somente a reutilizacao consciente do slot expirado.
- Respostas incluem `reserva_expira_em` e podem retornar status `Expirado`.
- Escritas e consultas operacionais normalizam reservas vencidas antes de calcular disponibilidade.
- A primeira tentativa de reutilizar o slot retorna `409` com codigo `CONFIRMACAO_SLOT_RESERVA_EXPIRADA` e o contexto das reservas sobrepostas.
- A primeira tentativa de mudar a propria reserva de `Expirado` para `Agendado` retorna `409` com codigo `CONFIRMACAO_REATIVACAO_RESERVA_EXPIRADA`; a repeticao confirmada revalida o slot antes de salvar. Outros status ativos exigem a passagem inicial por `Agendado`.

### Banco/migracoes

- `20260719_50`: adiciona `clinicas.whatsapps` em JSON/JSONB e aproveita o telefone existente.
- `20260719_51`: adiciona `agendamentos.reserva_expira_em`.
- A constraint `ex_agendamentos_slot_ativo` continua protegendo apenas os status ativos; `Expirado` nao participa.

### Frontend

- Cadastro e edicao de clinica recebem lista dinamica de WhatsApps.
- Modal da agenda prepara mensagem para reserva ou agendamento.
- Modal da agenda recebe a quantidade de horas para confirmacao, recalcula e exibe o vencimento exato.
- Modal da agenda permite editar o WhatsApp da clinica ou do tutor selecionado e atualiza o contato usado pela mensagem.
- A tela pos-criacao oferece seletor quando a clinica tem multiplos numeros.
- Agenda e FullCalendar tratam `Expirado` como status nao bloqueante.
- A Agenda destaca reservas na ultima hora, torna o alerta critico nos 15 minutos finais e atualiza a contagem regressiva sem recarregar a pagina.
- O modal compartilhado de novo agendamento exige a revisao das mensagens antes de repetir a escrita com o campo de confirmacao.
- Reservas expiradas exibem a acao `Agendar apos confirmacao tardia` nas duas visualizacoes da agenda.

## 5) Compatibilidade e rollout

- Clinicas antigas continuam com o telefone existente como primeiro destino.
- Reservas antigas sem `reserva_expira_em` continuam validas ate acao manual.
- Rollback exige reverter codigo; as novas colunas podem permanecer sem uso.

## 6) Criterios de aceitacao (CA)

- CA-001: marcar reserva preenche prazo com tres horas a partir do momento atual e permite ajuste entre 0,5 e 72 horas.
- CA-002: prazo passado ou posterior/igual ao atendimento impede salvar.
- CA-003: mensagem de reserva segue o modelo e usa `Pendente` para tutor/paciente ausentes.
- CA-004: mensagem de agendamento informa que o horario solicitado foi agendado.
- CA-005: `Abrir WhatsApp` usa telefone normalizado com DDI 55 e texto codificado.
- CA-006: clinica salva, lista e atualiza multiplos WhatsApps sem duplicatas.
- CA-007: mais de um numero produz seletor antes de abrir o WhatsApp.
- CA-008: ausencia de numero permite escolher contato manualmente.
- CA-009: reserva sem paciente persiste `NULL` e respeita `fk_agenda_paciente`.
- CA-010: reserva vencida passa a `Expirado`; a primeira tentativa de ocupar o mesmo slot retorna confirmacao obrigatoria e somente a repeticao confirmada cria o novo registro.
- CA-011: incluir ou editar WhatsApp na agenda persiste o novo contato e o utiliza na mensagem criada em seguida.
- CA-012: atualizar WhatsApps da clinica pela agenda nao altera nome, endereco ou demais dados do cadastro.
- CA-013: reserva com no maximo 60 minutos restantes aparece em um alerta explicito com contagem regressiva, clinica, horario e dados conhecidos do tutor/pet.
- CA-014: nos 15 minutos finais, o alerta usa destaque vermelho e identificacao visual critica.
- CA-015: cancelar a confirmacao de slot expirado mantem o modal aberto e nao cria o agendamento.
- CA-016: confirmar a revisao permite reutilizar o slot livre, mas continua retornando conflito caso exista qualquer agendamento ativo sobreposto.
- CA-017: `Expirado` oferece a acao `Agendar apos confirmacao tardia`; sem confirmacao a API retorna `CONFIRMACAO_REATIVACAO_RESERVA_EXPIRADA`.
- CA-018: confirmar a resposta tardia muda a mesma reserva para `Agendado` quando o slot esta livre e mantem o bloqueio quando outro atendimento ja ocupa o horario.
- CA-019: a reativacao continua exigindo paciente e tutor para o status `Agendado` e registra a confirmacao tardia na auditoria.

## 7) Casos de borda

- CB-001: reserva sem tutor permite somente clinica quando houver clinica selecionada.
- CB-002: atendimento domiciliar permite somente tutor.
- CB-003: horario iniciado em menos de tres horas exige ajuste do prazo para um instante anterior ao atendimento.
- CB-004: falha de clipboard nao desfaz o registro criado.
- CB-005: reserva `Expirado` nao pode ser reativada silenciosamente; o mesmo registro pode passar para `Agendado` somente pela confirmacao tardia e apos nova validacao de disponibilidade.
- CB-006: prazo menor que 0,5 hora, maior que 72 horas ou posterior ao inicio do atendimento impede salvar.
- CB-007: edicao de contato aberta precisa ser salva ou cancelada antes da criacao do agendamento.
- CB-008: dados ausentes na reserva expirada aparecem como `Pendente` na confirmacao e nao impedem a revisao manual.
- CB-009: mais de uma reserva expirada sobreposta deve ser informada pela API e registrada na auditoria quando o slot for reutilizado.

## 8) Fora de escopo

- Envio automatico pela Meta.
- Processamento de respostas do WhatsApp.
- Configuracao multiprofissional do nome/especialidade exibidos na mensagem.
