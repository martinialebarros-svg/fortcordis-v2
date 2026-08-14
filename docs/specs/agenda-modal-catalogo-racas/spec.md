# Spec

## Escopo

Substituir o campo livre de raça no modal **Cadastrar Animal** da Agenda por um
catálogo selecionável por espécie, com gestão local de cadastro, edição e
exclusão de raças.

## Requisitos

- RF-001: o campo `Raça` do modal de cadastro de animal deve ser um menu
  dropdown com as raças aplicáveis à espécie selecionada.
- RF-002: as opções devem ser apresentadas em ordem alfabética, incluindo as
  raças personalizadas.
- RF-003: o modal deve permitir cadastrar uma nova raça para a espécie atual e
  selecioná-la para o animal em cadastro.
- RF-004: o modal deve permitir editar ou excluir a raça atualmente
  selecionada no catálogo, com confirmação explícita antes da exclusão.
- RF-005: as alterações do catálogo devem permanecer no navegador, usando o
  armazenamento local já adotado para raças personalizadas.
- RF-006: editar ou excluir uma raça do catálogo não deve alterar dados de
  pacientes já persistidos; uma raça histórica ainda deve permanecer
  selecionável ao editar um animal que a possua.

## Contrato e dados

- Endpoint: sem alteração.
- Persistência clínica: sem alteração no payload de `POST /pacientes`.
- Persistência do catálogo: `localStorage`, nas chaves
  `fortcordis:racas-custom-por-especie` e
  `fortcordis:racas-ajustes-por-especie`.
- Migração: não aplicável.

## Critérios de aceitação

- CA-001: ao abrir o modal para uma espécie, `Raça` não aceita digitação livre
  e apresenta o catálogo ordenado alfabeticamente.
- CA-002: cadastrar uma raça nova a torna disponível e já selecionada no pet.
- CA-003: editar uma raça selecionada atualiza o catálogo e a seleção corrente,
  sem aceitar nomes duplicados.
- CA-004: excluir uma raça solicita confirmação, remove a opção para cadastros
  futuros e limpa a seleção do novo pet.
- CA-005: uma raça removida que já exista em paciente previamente cadastrado
  não é apagada nem impedida de aparecer como valor histórico.

## Fora de escopo

- Sincronização do catálogo entre usuários, navegadores ou unidades.
- Atualização em massa da raça armazenada em pacientes existentes.
- Alterações em endpoints, banco de dados ou regras clínicas do paciente.
