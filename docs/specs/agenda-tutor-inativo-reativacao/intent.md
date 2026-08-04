# Intent - agenda-tutor-inativo-reativacao

Data: 2026-08-04

Responsavel: Martiniano + Codex
Status: in-progress

## Problema

Ao cadastrar na Agenda um tutor cujo nome ja existia em um registro inativo, a API retornava o ID antigo como se o cadastro novo tivesse sido concluido. O modal vinculava o animal a esse ID, mas a busca de tutores ocultava o registro por estar inativo.

## Objetivo

Impedir o reaproveitamento silencioso de tutor inativo e permitir sua reativacao apenas apos confirmacao clara da pessoa usuaria.

## Resultado esperado

- A tentativa inicial informa que existe um cadastro inativo homonimo.
- A reativacao exige confirmacao explicita no modal.
- Apos confirmacao, o tutor fica ativo, pode ser encontrado na Agenda e o mesmo ID historico e preservado.
