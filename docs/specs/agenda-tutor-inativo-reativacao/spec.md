# Spec - agenda-tutor-inativo-reativacao

Data: 2026-08-04

Responsavel: Codex
Status: in-progress

## Escopo

Corrigir o cadastro de tutor no modal de novo agendamento quando ja existir um tutor inativo com a mesma chave de nome.

## Requisitos funcionais

- RF-001: `POST /api/v1/tutores` deve responder `409` com codigo `TUTOR_INATIVO_EXISTENTE`, nome e ID do tutor quando encontrar cadastro inativo equivalente sem confirmacao de reativacao.
- RF-002: com `confirmar_reativacao=true`, a API deve reativar o mesmo registro, manter seu ID e atualizar apenas campos novos informados.
- RF-003: o modal deve explicar que encontrou cadastro anterior e solicitar confirmacao antes de enviar a reativacao.
- RF-004: apos reativado, o tutor deve voltar a aparecer em `GET /api/v1/tutores?busca=` e continuar apto a vincular pets e agendamentos.

## Requisitos nao funcionais

- NFR-001: a tentativa sem confirmacao nao pode alterar `ativo` nem os dados de contato existentes.
- NFR-002: o comportamento idempotente para tutor ja ativo com o mesmo nome deve permanecer inalterado.
- NFR-003: a interface deve usar linguagem clara em portugues e nao criar duplicidade de tutor.

## Criterios de aceitacao

- CA-001: um tutor inativo "Genival Filho" retorna conflito estruturado na primeira tentativa de cadastro.
- CA-002: apos a confirmacao, o mesmo tutor passa para ativo e aparece ao buscar "genival".
- CA-003: a tentativa cancelada preserva o tutor inativo e seus dados anteriores.
- CA-004: repetir o cadastro de tutor ativo continua retornando o registro existente sem criar duplicata.

## Fora de escopo

- Mesclagem de tutores distintos com nomes coincidentes.
- Reativacao em massa de cadastros historicos.
