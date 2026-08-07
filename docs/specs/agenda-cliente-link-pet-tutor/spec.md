# Spec

## Escopo

Adicionar um modal de edicao rapida de cliente (tutor + pet), acessivel a partir do nome do pet/tutor nos cards de agendamento da agenda em lista e do FullCalendar.

## Requisitos

- Nos cards da agenda em lista (`/agenda`) e no painel de detalhes do FullCalendar (`/agenda/fullcalendar`), o nome do pet e o nome do tutor devem virar um botao sempre que o agendamento tiver `paciente_id` e/ou `tutor_id`.
- O clique abre `ClienteInfoModal`, que busca os dados via `GET /pacientes/{paciente_id}` quando houver pet vinculado, ou via `GET /tutores/{tutor_id}` quando o agendamento so tiver tutor.
- Salvar no modo paciente envia `PUT /pacientes/{paciente_id}` com os mesmos campos usados em `/pacientes/[id]` (dados do tutor com prefixo `tutor_` + dados clinicos do pet), incluindo `tutor_id` para o backend resolver o vinculo sem duplicar o tutor.
- Salvar no modo somente-tutor envia `PUT /tutores/{tutor_id}` com os campos do tutor.
- Apos salvar com sucesso, a lista de agendamentos e recarregada para refletir nomes atualizados.
- O modal oferece um link para abrir `/pacientes/{paciente_id}` (cadastro completo) quando houver pet vinculado.
- Quando nao houver `paciente_id` nem `tutor_id`, o nome permanece texto simples (sem atalho).

## Fora de escopo

- Criar uma tela dedicada para tutor (`/tutores/[id]`).
- Alterar o formulario completo de `/pacientes/[id]` (historico clinico, exclusao, inicio de atendimento etc.).
- Editar dados do animal quando o agendamento so tiver tutor vinculado (nesse caso o modal cobre apenas o tutor; o pet e cadastrado depois pelo fluxo existente).
