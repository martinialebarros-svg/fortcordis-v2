# Spec - agenda-novo-agendamento-searchable-selects

Data: 2026-04-18  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Este ciclo melhora a experiencia do modal de novo agendamento em `frontend/app/agenda/NovoAgendamentoModal.tsx`. Os campos de `Tutor`, `Animal` e `Clinica` deixam de depender apenas de `select` nativo e passam a usar selecao pesquisavel no frontend. A entrega mantem os mesmos endpoints e payloads ja existentes, sem alterar regras de negocio do agendamento.

## 2) Requisitos funcionais (RF)

- RF-001: o campo `Tutor` deve permitir busca textual por nome e, quando disponivel, por telefone.
- RF-002: o campo `Animal` deve permitir busca textual por nome do animal e por dados auxiliares como tutor, especie e raca.
- RF-003: o campo `Animal` deve continuar respeitando o filtro existente por tutor selecionado.
- RF-004: o campo `Clinica` deve exibir endereco explicito nas opcoes do dropdown.
- RF-005: o campo `Clinica` deve permitir busca textual por nome da clinica e pelo endereco formatado.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a busca deve ocorrer localmente sobre os dados ja carregados, sem chamadas extras por tecla digitada.
- NFR-002 (seguranca/permissoes): nao deve haver mudanca de permissao, autenticacao ou contrato dos endpoints usados pelo modal.
- NFR-003 (observabilidade): a mudanca deve ser validavel por lint do arquivo alterado e por inspecao do diff.

## 4) Contratos tecnicos

### API

- Endpoint: `/tutores?limit=1000`, `/pacientes?limit=1000`, `/clinicas?limit=1000`
- Metodo: `GET`
- Payload: sem mudanca
- Resposta: sem mudanca; a tela reutiliza os campos ja retornados, inclusive endereco da clinica

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma
- Indices/constraints: nenhum
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/agenda/NovoAgendamentoModal.tsx`
- Estados de UI: aberto/fechado do dropdown, filtro de busca textual, item selecionado, lista vazia
- Regras de exibicao/erro:
  - `Tutor` mostra busca por nome/telefone
  - `Animal` mostra busca por nome/tutor/especie/raca
  - `Clinica` mostra nome e endereco formatado
  - se nao houver correspondencia, o componente informa que nenhum item foi encontrado

## 5) Compatibilidade e rollout

- Backward compatibility: mantida; o envio do formulario e os IDs selecionados continuam os mesmos
- Feature flag (se houver): nao
- Estrategia de rollback: reverter o commit do modal e restaurar os `select` nativos anteriores

## 6) Criterios de aceitacao (CA)

- CA-001: o usuario consegue localizar tutor digitando nome ou telefone no modal.
- CA-002: o usuario consegue localizar animal digitando nome do animal ou nome do tutor, mantendo o filtro por tutor quando aplicavel.
- CA-003: o dropdown de clinica mostra endereco legivel em cada opcao.
- CA-004: o item de clinica selecionado continua exibindo o endereco apos a escolha.
- CA-005: o arquivo alterado passa em `eslint` sem erros.

## 7) Casos de borda

- CB-001: tutores sem telefone continuam selecionaveis e pesquisaveis por nome.
- CB-002: clinicas sem endereco completo devem continuar aparecendo, com fallback textual coerente.
- CB-003: quando um tutor e selecionado, animais de outros tutores nao devem aparecer na lista filtrada.

## 8) Fora de escopo

- Criar busca remota paginada para bases muito grandes.
- Alterar o cadastro rapido de clinica, tutor ou animal neste ciclo.
