# Spec - whatsapp-equipe-atendentes-edicao

## Requisitos funcionais

- RF-001: `PATCH /agents/:id` deve aceitar atualização parcial de `name`,
  `email`, `role` e/ou `active`, alterando apenas os campos presentes no
  corpo da requisição.
- RF-002: quando `email` for informado, deve ser uma string não vazia; caso
  contrário a requisição é rejeitada com `400`.
- RF-003: quando `name` for informado, deve ser `string` ou `null`; qualquer
  outro tipo é rejeitado com `400`.
- RF-004: quando `role` for informado, deve ser uma string não vazia; caso
  contrário a requisição é rejeitada com `400`.
- RF-005: se nenhum campo atualizável (`name`, `email`, `role`, `active`) for
  enviado, a requisição é rejeitada com `400`.
- RF-006: se o `id` não corresponder a um atendente existente, a resposta é
  `404`.
- RF-007: a UI da seção "Configurar equipe" deve permitir abrir um formulário
  de edição inline por atendente (nome, email, perfil) com ações Salvar e
  Cancelar.
- RF-008: a UI deve oferecer uma ação "Desativar"/"Reativar" que alterna o
  campo `active` sem exigir abrir o formulário de edição completo.
- RF-009: após salvar uma edição ou alternar o status, a lista de atendentes
  deve ser recarregada a partir do backend (sem depender de estado otimista).

## Requisitos não funcionais

- NFR-001 (segurança): o endpoint permanece sob `requireApiAuth`, usando o
  mesmo conjunto de papéis de escrita já aplicado a `POST /agents`.
- NFR-002 (compatibilidade): os contratos existentes de `GET /agents` e
  `POST /agents` não são alterados.
- NFR-003 (consistência): o e-mail é normalizado (trim + lowercase) da mesma
  forma que em `createAgent`.

## Contratos de API

### `PATCH /agents/:id`

Corpo (todos os campos opcionais, ao menos um obrigatório):

```json
{ "name": "Ana Paula", "email": "ana@fortcordis.com", "role": "supervisor", "active": true }
```

Respostas:

- `200` com o atendente atualizado (`id`, `name`, `email`, `role`, `active`,
  `created_at`);
- `400` quando nenhum campo atualizável é enviado ou um campo tem tipo/valor
  inválido;
- `404` quando o `id` não existe.

## Critérios de aceitação

- CA-001: editar nome e perfil de um atendente existente reflete a mudança na
  lista após salvar.
- CA-002: alternar "Desativar"/"Reativar" muda o status exibido (Ativo/
  Inativo) sem precisar abrir o formulário de edição.
- CA-003: tentar salvar com email vazio é bloqueado antes de chamar a API.
- CA-004: `PATCH /agents/:id` para um id inexistente retorna `404`.
- CA-005: `PATCH /agents/:id` sem nenhum campo retorna `400`.
