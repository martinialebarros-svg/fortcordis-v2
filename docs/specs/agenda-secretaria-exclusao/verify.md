# Verification

- Teste automatizado confirma que `excluir` muda de `0` para `1` para o papel `secretaria` no modulo `agenda`.
- Teste automatizado confirma a criacao idempotente da permissao quando a linha nao existe.
- O deploy de producao deve executar a migracao `20260714_49` antes de reiniciar o backend.
- A validacao funcional final e excluir um agendamento com uma sessao autenticada de secretaria.
