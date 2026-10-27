# Spec — agenda-tutor-inativo-reativacao

Atualizacao: 2026-10-27
Status: implemented-local

A regra original de 2026-08-04 foi substituida por
[identidade e mesclagem de tutores](../tutores-identidade-mesclagem/spec.md).

- RF-001: criar tutor homonimo nao reativa nem altera outro cadastro.
- RF-002: reativacao exige o ID escolhido explicitamente e confirmacao em
  `POST /tutores/{id}/reativar`; preserva os dados e o ID daquele tutor.
- RF-003: `confirmar_reativacao=true` no POST de criacao sem ID e recusado;
  nome nao seleciona uma pessoa, ativa ou inativa.
- RF-004: tutor mesclado nao pode ser reativado. Tutor apenas inativo pode ser
  reativado pelo endpoint por ID e volta a busca.

## Aceitacao

- CA-001: criar homonimo preserva o ID antigo inativo e seus contatos.
- CA-002: reativacao com ID e confirmacao torna esse cadastro ativo e pesquisavel.
- CA-003: reativacao sem confirmar nao muda nada.
- CA-004: POST com nome igual ao de tutor ativo cria outro ID.
