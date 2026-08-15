# Verification

- Teste automatizado confirma que o endpoint aceita `recepcao`, `secretaria` e variantes acentuadas.
- Teste automatizado confirma que `excluir` muda de `0` para `1` para o papel real `recepcao` no modulo `agenda`.
- Teste automatizado confirma a criacao idempotente da permissao para todos os aliases quando a linha nao existe.
- Teste automatizado confirma que outros papeis continuam sem permissao de exclusao.
- O deploy de producao deve executar a migracao `20260714_50` antes de reiniciar o backend.
- A validacao funcional final e excluir um agendamento com uma sessao autenticada da recepcao.
