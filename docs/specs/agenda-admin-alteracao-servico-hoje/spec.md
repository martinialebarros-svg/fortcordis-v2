# Alteração administrativa do serviço de agendamento de hoje

## Objetivo

Permitir que um administrador corrija o serviço de um agendamento do dia atual mediante confirmação explícita, sem transformar um atendimento já iniciado em uma remarcação.

## Requisitos funcionais

- RF-001: ao trocar o serviço de um agendamento de hoje, a interface deve solicitar confirmação explícita do administrador antes de salvar.
- RF-002: a API deve aceitar a confirmação somente de usuário com papel `admin`.
- RF-003: sem confirmação, a API deve responder com conflito confirmável e não persistir a troca.
- RF-004: perfis não administradores não podem confirmar nem efetivar a troca do serviço de um agendamento de hoje.
- RF-005: se o horário original já tiver iniciado, a troca confirmada deve preservar início e fim originais.
- RF-006: se o horário ainda não tiver iniciado, a duração do novo serviço e as validações operacionais existentes continuam aplicáveis.
- RF-007: a auditoria deve registrar a confirmação e se o intervalo original foi preservado.

## Requisito de teste

- RT-001: o cenário automatizado de atendimento já iniciado deve permanecer no dia local corrente entre 00:00 e 01:59 em `America/Fortaleza`, preservando as mesmas asserções de autorização e intervalo.

## Critérios de aceite

- CA-001: admin vê a confirmação explícita da troca e pode voltar sem salvar.
- CA-002: ao confirmar, o serviço é atualizado.
- CA-003: atendimento já iniciado não ganha sobreposição apenas pela correção administrativa do serviço.
- CA-004: chamada direta sem confirmação ou por não-admin é bloqueada pelo backend.
- CA-005: a suíte direcionada passa antes e depois da virada do dia sem alterar o comportamento de produção.
