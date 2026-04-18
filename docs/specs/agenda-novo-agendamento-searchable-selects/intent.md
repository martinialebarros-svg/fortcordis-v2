# Intent - agenda-novo-agendamento-searchable-selects

Data: 2026-04-18  
Responsavel: Codex  
Status: done

## Contexto

No modal de novo agendamento em `frontend/app/agenda/NovoAgendamentoModal.tsx`, os campos de `Tutor`, `Animal` e `Clinica` usavam `select` nativo com listas longas. Na pratica, a equipe precisava rolar manualmente para encontrar registros, o que aumentava atrito operacional e tempo de preenchimento.

No caso de `Clinica`, o dropdown mostrava apenas o nome, sem explicitar o endereco da unidade durante a escolha. Isso dificultava distinguir clinicas com nomes parecidos ou recorrentes.

## Objetivo

Tornar a selecao no modal de novo agendamento mais eficiente e menos ambigua, com busca textual para `Tutor` e `Animal`, e com endereco explicito nas opcoes de `Clinica`.

## Nao objetivos

- Alterar contratos de backend para agenda, pacientes, tutores ou clinicas.
- Redesenhar o modal inteiro de novo agendamento.
- Introduzir dependencias externas de UI para combobox neste ciclo.

## Impacto esperado

- Reducao do tempo para localizar tutor e animal em bases longas.
- Menor risco de escolher a clinica errada por falta de endereco visivel.
- Preservacao do fluxo atual de filtro de animais por tutor selecionado.
