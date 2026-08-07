# Plan

1. Levantar os contratos existentes de `GET/PUT /pacientes/{id}` e `GET/PUT /tutores/{id}` e reaproveitar os mesmos campos do formulario de `/pacientes/[id]`.
2. Criar `frontend/app/agenda/ClienteInfoModal.tsx` com dois modos (paciente+tutor / somente tutor), reaproveitando helpers de formatacao (`lib/atendimento-cadastro`, `lib/racas`).
3. Tornar o nome do pet e do tutor clicaveis em `frontend/app/agenda/page.tsx`, abrindo o modal com `paciente_id` ou, na ausencia deste, `tutor_id`.
4. Repetir a mesma integracao no painel de detalhes de `frontend/app/agenda/fullcalendar/page.tsx` (import dinamico, como ja e feito com `NovoAgendamentoModal`).
5. Recarregar a lista de agendamentos apos salvar, para refletir nomes atualizados no card.
6. Validar com `tsc --noEmit`, ESLint focado nos arquivos alterados, `npm run build` e um teste manual ponta a ponta local (backend + frontend).
