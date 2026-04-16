# Spec - atendimento-prescricao-item-manual

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Corrigir a entrada manual de itens na prescricao do atendimento para que o clique em `Item manual` retire a tela do estado inicial vazio e exponha o editor do item. A entrega tambem cobre o reset desse estado auxiliar ao carregar outro atendimento, iniciar um novo atendimento ou limpar o ultimo item da receita.

## 2) Requisitos funcionais (RF)

- RF-001: ao clicar em `Item manual`, o editor de itens da receita deve ficar visivel mesmo quando a prescricao estiver no estado inicial vazio.
- RF-002: ao clicar em `Item manual`, a interface deve levar o usuario para a secao de itens para tornar a acao perceptivel.
- RF-003: o estado auxiliar do editor manual deve ser resetado ao hidratar outro atendimento, iniciar um atendimento novo ou limpar o ultimo item da prescricao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a correcao nao deve introduzir busca adicional, chamada de API ou recalculo pesado.
- NFR-002 (seguranca/permissoes): nenhuma permissao nova; mudanca restrita a estado de UI no frontend.
- NFR-003 (observabilidade): o comportamento deve ser verificavel por lint local e checklist manual do fluxo na tela.

## 4) Contratos tecnicos

### API

- Endpoint: sem alteracao.
- Metodo: sem alteracao.
- Payload: sem alteracao.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx`, `frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx`.
- Estados de UI: `prescricaoEditorManualAberto`, `prescricaoTemRascunhoInicial`.
- Regras de exibicao/erro: o estado de receita vazia nao deve ocultar o editor apos clique em `Item manual`; ao remover o ultimo item, a tela pode voltar ao estado vazio padrao.

## 5) Compatibilidade e rollout

- Backward compatibility: total, sem alterar payloads ou persistencia.
- Feature flag (se houver): nao ha.
- Estrategia de rollback: reverter o commit frontend que introduz o estado `prescricaoEditorManualAberto` e o scroll para `#prescricao-itens`.

## 6) Criterios de aceitacao (CA)

- CA-001: em receita vazia, clicar em `Item manual` faz o editor do item ficar visivel.
- CA-002: ao abrir manualmente um item, a tela navega ate a secao de itens da receita.
- CA-003: carregar outro atendimento, iniciar um novo ou remover o ultimo item restaura o comportamento padrao do estado vazio.

## 7) Casos de borda

- CB-001: a receita possui apenas um item vazio inicial e o usuario clica em `Item manual`.
- CB-002: o usuario remove o unico item existente apos ter aberto o editor manual.

## 8) Fora de escopo

- Alterar o fluxo de busca de medicamentos industrializados ou manipulados.
- Criar testes E2E ou refatorar toda a arquitetura do workspace de prescricao.
