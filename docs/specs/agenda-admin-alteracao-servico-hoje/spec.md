# Alteração administrativa do serviço de agendamento já iniciado

## Objetivo

Permitir que um administrador corrija o serviço de um agendamento cujo atendimento já começou, mediante confirmação explícita, sem transformar essa correção em uma remarcação. Perfis com permissão geral de editar agendamento (ex.: secretária) podem trocar o serviço livremente enquanto o atendimento ainda não tiver iniciado.

## Requisitos funcionais

- RF-001: ao trocar o serviço de um agendamento cujo atendimento já iniciou, a interface deve solicitar confirmação explícita do administrador antes de salvar.
- RF-002: a API deve aceitar a confirmação somente de usuário com papel `admin`.
- RF-003: sem confirmação, a API deve responder com conflito confirmável e não persistir a troca.
- RF-004: perfis não administradores não podem confirmar nem efetivar a troca do serviço de um atendimento já iniciado.
- RF-005: se o horário original já tiver iniciado, a troca confirmada deve preservar início e fim originais.
- RF-006: se o horário ainda não tiver iniciado, qualquer perfil com permissão de editar o agendamento pode trocar o serviço; a duração do novo serviço e as validações operacionais existentes continuam aplicáveis.
- RF-007: a auditoria deve registrar a confirmação e se o intervalo original foi preservado.

## Requisito de teste

- RT-001: o cenário automatizado de atendimento já iniciado deve permanecer no dia local corrente entre 00:00 e 01:59 em `America/Fortaleza`, preservando as mesmas asserções de autorização e intervalo.

## Critérios de aceite

- CA-001: admin vê a confirmação explícita da troca e pode voltar sem salvar.
- CA-002: ao confirmar, o serviço é atualizado.
- CA-003: atendimento já iniciado não ganha sobreposição apenas pela correção administrativa do serviço.
- CA-004: chamada direta sem confirmação ou por não-admin, para um atendimento já iniciado, é bloqueada pelo backend.
- CA-005: a suíte direcionada passa antes e depois da virada do dia sem alterar o comportamento de produção.
- CA-006: um perfil não administrador com permissão de editar agendamento (ex.: secretária) consegue trocar o serviço de um agendamento de hoje cujo atendimento ainda não começou, sem exigir confirmação administrativa.
