# Spec - agenda-progressive-loading

Data: 2026-09-21

Responsavel: Codex / equipe FortCordis

Status: ready_for_stage

## 1) Escopo funcional

Tornar progressiva a carga da lista em `/agenda`, separando o contrato principal das leituras auxiliares de relacionados e resumo financeiro sem alterar regras, permissoes ou contratos de API.

## 2) Requisitos funcionais

- RF-001: a resposta bem-sucedida de `GET /agenda` deve atualizar a lista e encerrar o indicador principal sem aguardar leituras auxiliares.
- RF-002: relacionados e resumo financeiro solicitados pela mesma atualizacao devem iniciar em paralelo e falhar de forma independente.
- RF-003: entrada e mudanca de periodo devem delegar o resumo exclusivamente ao efeito dedicado, evitando uma segunda chamada pela carga principal.
- RF-004: atualizacao manual e cargas posteriores a mutacoes devem continuar renovando o resumo financeiro.
- RF-005: somente a requisicao principal mais recente pode atualizar lista, erro e indicador de carregamento.
- RF-006: somente a requisicao mais recente de relacionados pode atualizar laudos, Ordens de Servico e enderecos.
- RF-007: somente a requisicao mais recente do resumo financeiro pode atualizar valor, erro e indicador do card.

## 3) Requisitos nao funcionais

- NFR-001 (performance): leituras auxiliares nao prolongam a fase principal de carregamento.
- NFR-002 (resiliencia): falha auxiliar nao converte sucesso da lista principal em falha global.
- NFR-003 (consistencia): respostas obsoletas nao substituem filtros ou periodos atuais.
- NFR-004 (compatibilidade): endpoints, payloads, autorizacao e regras financeiras permanecem inalterados.
- NFR-005 (seguranca): a entrega nao adiciona escrita, migracao ou chamada externa.

## 4) Contratos tecnicos

### API

- Contratos existentes preservados: `GET /api/v1/agenda`, `GET /api/v1/agenda/relacionados` e `GET /api/v1/agenda/resumo-financeiro`.
- Nenhum novo endpoint ou parametro.

### Banco/migracoes

- Nenhuma alteracao.

### Frontend

- `frontend/app/agenda/page.tsx`: orquestracao progressiva e sequencias de requisicao.
- `frontend/lib/agenda-loading.ts`: executor de leituras auxiliares com `Promise.allSettled`.
- `frontend/lib/agenda-loading.test.ts`: paralelismo e isolamento de falhas.

## 5) Criterios de aceitacao

- CA-001: teste prova que todas as leituras auxiliares sao iniciadas antes de qualquer uma concluir.
- CA-002: teste prova que uma falha auxiliar nao rejeita o conjunto nem impede outra leitura.
- CA-003: inspecao e typecheck provam protecao de sequencia para lista, relacionados e resumo.
- CA-004: smoke autenticado em stage confirma lista, cards financeiros, atalhos e atualizacao manual sem erro visivel.
- CA-005: lint, build, testes focados e guardrail SDD passam.

## 6) Casos de borda

- CB-001: periodo sem agendamentos limpa relacionados somente se ainda for a carga atual.
- CB-002: mudanca rapida de periodo ignora resposta atrasada da lista anterior.
- CB-003: mudanca rapida de filtro ignora resposta atrasada do resumo anterior.
- CB-004: evento em tempo real atualiza a lista sem forcar relacionados ou resumo, preservando o comportamento existente.
- CB-005: erro 401 da carga atual continua encerrando a sessao; erro 401 obsoleto e ignorado.
