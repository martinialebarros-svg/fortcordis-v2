# Intent

Transformar o nome do pet e do tutor exibidos no card de agendamento em atalhos para editar os dados do cliente sem sair da agenda.

## Contexto

Na agenda (lista e FullCalendar), o nome do paciente e do tutor sao apenas texto. Para corrigir ou completar um telefone, endereco ou dado clinico do pet, o usuario precisa navegar ate `/pacientes/[id]`, perdendo o contexto da agenda. Agendamentos com status Reservado podem existir sem pet vinculado ainda (`paciente_id` nulo), so com tutor.

## Resultado esperado

- Nome do pet e nome do tutor no card do agendamento viram atalhos clicaveis.
- O clique abre um modal com os dados do tutor (e do pet, quando houver) para edicao imediata.
- Quando so existe tutor vinculado (sem pet definido ainda), o modal permite editar os dados do tutor mesmo assim.
- Um link no modal permite abrir o cadastro completo do paciente quando aplicavel.
