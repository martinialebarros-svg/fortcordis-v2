# Spec - agenda-formalizacao-portal-clinicas

## Requisitos funcionais

- RF-001: nova tabela `agenda_formalizacao_invites`
  (`backend/app/models/agenda_formalizacao.py`) guarda apenas o hash do
  token (`token_hash`, SHA-256 com `SECRET_KEY`), nunca o valor bruto,
  vinculada a um `agendamento_id` (sem FK, mesmo padrão do resto de
  `Agendamento`). Status: `pending` / `used` / `expired` / `revoked`.
- RF-002: `criar_ou_reutilizar_convite` usa `agendamento.reserva_expira_em`
  como prazo do convite quando ainda está no futuro; caso contrário
  (ausente ou já vencido), usa o default `AGENDA_FORMALIZACAO_INVITE_DEFAULT_HOURS`
  (72h). Emitir um novo convite revoga qualquer convite `pending`
  anterior do mesmo agendamento (o token bruto do anterior não pode
  mais ser recuperado, então não há como "reaproveitar" o link antigo).
- RF-003: `GET /api/v1/agenda/formalizacao/{token}` e
  `POST /api/v1/agenda/formalizacao/{token}` são endpoints públicos
  (sem autenticação) protegidos apenas pelo token opaco. O GET devolve
  nome da clínica, serviço, data/hora e `expires_at`; retorna `404`
  para token desconhecido e `410` para convite usado/expirado/revogado.
- RF-004: o POST aceita `nome_paciente`, `nome_tutor`, `telefone_tutor`;
  localiza ou cria o Tutor por nome normalizado (`nome_key`, mesmo
  algoritmo de `pacientes.py`), só sobrescrevendo telefone/whatsapp do
  tutor existente se ele ainda não tiver nenhum contato cadastrado;
  cria o Paciente vinculado a esse tutor (espécie default "Canina");
  atualiza `Agendamento.paciente_id`/`tutor_id`/campos denormalizados e
  transiciona `status` de `Reservado` para `Agendado` (mantém
  `Agendado` se já estava); marca o convite como `used`.
- RF-005: após salvar os dados com sucesso, tenta enviar
  `appointmentFormalized` para a clínica (via `_resolve_destination`,
  mesmo helper do lembrete automático) dentro de um `try/except` que
  nunca bloqueia nem desfaz o salvamento em caso de falha (modelo ainda
  não aprovado pela Meta neste momento, é esperado que falhe).
- RF-006: `build_agenda_utility_template` ganha o `template_key`
  `"appointmentFormalized"`, com 7 parâmetros (destinatário, serviço,
  paciente, tutor, data, hora, unidade) — cai na mesma validação
  estrita de paciente/tutor vinculados que os demais modelos que não
  são `appointmentMissingData`.
- RF-007: `POST /api/v1/integracoes/whatsapp/agenda/{agendamento_id}/link-formalizacao`
  (protegido pelo token interno `X-FortCordis-WhatsApp-Token`) gera um
  convite novo e devolve `{link, expires_at}`, usando
  `PUBLIC_APP_BASE_URL` (não `request.base_url`, porque quem chama é o
  whatsapp-stage-backend diretamente, não um navegador atrás do proxy
  público) para montar `{PUBLIC_APP_BASE_URL}/agenda/formalizar/{token}`.
- RF-008: `process_button_response`/`Action` ganham a ação
  `"falar_equipe"`: cria alerta interno
  (`whatsapp_agenda_falar_equipe`), independente do status atual do
  agendamento, mesmo padrão de `solicitar_alteracao`.
- RF-009 (whatsapp-stage-backend): nova tabela
  `approved_template_button_events` (FK para
  `approved_template_messages`) dá idempotência por
  `provider_message_id` para cliques em botões de modelos aprovados
  genéricos — evita reenviar o link ou reprocessar a ação em reentregas
  do webhook da Meta.
- RF-010: `handleApprovedTemplateButtonReply` (novo serviço) casa o
  payload do clique com `approved_template_messages.button_bindings`
  via `jsonb_array_elements`; rejeita (`processing_status = 'rejected'`)
  quando o remetente não bate com o destino cadastrado no envio
  original; despacha `enviar_dados` → chama RF-007 e envia o link como
  texto livre na conversa; despacha `falar_equipe` → chama o endpoint
  existente de RF-008.
- RF-011: nova página pública `frontend/app/agenda/formalizar/[token]/page.tsx`
  (sem `DashboardLayout`, sem autenticação) busca o contexto no mount,
  renderiza formulário de 3 campos, mostra sucesso/erro.

## Critérios de aceitação

- CA-001: convite criado com `reserva_expira_em` no futuro usa esse
  valor como `expires_at`; sem prazo (ou já vencido), usa o default
  configurado.
- CA-002: emitir um segundo convite para o mesmo agendamento invalida
  (`410`) o token do primeiro.
- CA-003: `GET` com token inexistente → `404`; com token expirado →
  `410` e o registro persiste como `expired`.
- CA-004: submissão válida cria/vincula paciente e tutor, muda o status
  para `Agendado`, marca o convite `used`; submissão num convite já
  `used` falha com `410`.
- CA-005: tutor já existente (por nome normalizado) é reaproveitado sem
  duplicar e sem sobrescrever telefone/whatsapp já cadastrados.
- CA-006: falha ao enviar `appointmentFormalized` (ex.: modelo ainda
  não aprovado) não impede a submissão de retornar sucesso.
- CA-007: `build_agenda_utility_template("appointmentFormalized")`
  monta 7 parâmetros na ordem correta.
- CA-008 (Node): clique em "Enviar dados" gera exatamente uma chamada
  ao endpoint de link e uma mensagem de texto livre com o link, mesmo
  se o webhook reentregar o mesmo evento.
- CA-009 (Node): clique em "Falar com a equipe" chama o endpoint
  existente de resposta com `action: "falar_equipe"`.
- CA-010 (Node): clique com remetente diferente do destino cadastrado
  é rejeitado sem disparar nenhuma ação externa.
- CA-011 (frontend): a página carrega o contexto do token, envia os 3
  campos e mostra a mensagem de sucesso; token inválido mostra o erro
  devolvido pela API.
