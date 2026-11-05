# Especificação

- RF-001: POST/PUT da Agenda retornam 409 estruturado `CONFLITO_SOBREPOSICAO_AGENDA`, intervalos conflitantes e token de escopo para revisão.
- RF-002: somente admin autenticado pode enviar `confirmar_sobreposicao=true`, `escopo_sobreposicao_confirmado` e `motivo_excecao_sobreposicao`. Flag de rota/horário manual não concede sobreposição.
- RF-003: token deve corresponder ao intervalo/destino/serviço e conflitos atuais; mudança exige nova confirmação. Motivo obrigatório; concessão registra admin, instante e escopo em coluna própria e auditoria.
- RF-004: modal exibe conflitos e opção explícita “Autorizar sobreposição” para admin. Cancelar não reenvia. Campos e confirmação são reutilizáveis pelo Dot via interface; API não interpreta texto do chat.
- RF-005: concessão persiste para confirmação/status e alterações sem mudança de escopo; conflitos novos ou alterados exigem nova revisão. O agendamento original também pode avançar de status no escopo que o admin revisou. Slots autorizados continuam ocupados para solicitações comuns, inclusive quando o intervalo atravessa a meia-noite.
- RF-006: proteção PostgreSQL permite apenas linhas com concessão fora da exclusão comum. Lock transacional existente protege validações da API. Trigger revoga metadados reaproveitados ao alterar escopo via SQL. Nenhuma concessão retroativa na migração.
- RF-007: não sobrepor bloqueio administrativo; manter revisão de reserva expirada, identidade, duração e demais validações.

Critérios: admin com revisão atual salva conflito parcial de 15 minutos; não-admin/sem confirmação continuam bloqueados; token antigo/motivo vazio recusados; persistência, cancelamento UI, novos conflitos, alteração de escopo e concorrência comum verificados; migração idempotente em SQLite e PostgreSQL temporários.
