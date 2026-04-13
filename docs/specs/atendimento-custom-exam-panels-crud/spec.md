# Spec - atendimento-custom-exam-panels-crud

Data: 2026-04-13  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Esta entrega adiciona o CRUD de paineis customizados de exames no endpoint de atendimento, usando as tabelas de catalogo ja existentes. O frontend continua usando o mesmo modal, mas passa a receber respostas reais do backend e mostrar detalhe de erro quando houver falha.

## 2) Requisitos funcionais (RF)

- RF-001: `GET /atendimentos/paineis` deve listar apenas paineis customizados ativos.
- RF-002: `POST /atendimentos/paineis` deve criar painel customizado com nome, categoria e lista ordenada de exames do catalogo.
- RF-003: `PUT /atendimentos/paineis/{id}` deve atualizar apenas paineis customizados existentes.
- RF-004: `DELETE /atendimentos/paineis/{id}` deve fazer exclusao logica do painel customizado.
- RF-005: o frontend deve mostrar o detalhe real da API ao falhar criar/editar painel.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): operacoes devem ser leves, limitadas a leitura/escrita direta em `painel_exames` e `painel_exames_itens`.
- NFR-002 (seguranca/permissoes): endpoints continuam protegidos por `get_current_user`.
- NFR-003 (observabilidade): erros de validacao devem retornar detalhes legiveis para o frontend.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /api/v1/atendimentos/paineis`
- Metodo: GET
- Payload: nenhum
- Resposta: lista de paineis customizados com itens serializados

- Endpoint: `POST /api/v1/atendimentos/paineis`
- Metodo: POST
- Payload: `{ nome, categoria, especie_alvo, observacoes, ativo, itens[{catalogo_exame_id, ordem}] }`
- Resposta: painel criado com itens

- Endpoint: `PUT /api/v1/atendimentos/paineis/{painel_id}`
- Metodo: PUT
- Payload: mesmo contrato de criacao
- Resposta: painel atualizado com itens

- Endpoint: `DELETE /api/v1/atendimentos/paineis/{painel_id}`
- Metodo: DELETE
- Payload: nenhum
- Resposta: `{ message, id }`

### Banco/migracoes

- Tabelas/colunas afetadas: `painel_exames`, `painel_exames_itens`
- Indices/constraints: reaproveitar `codigo` unico existente em `painel_exames`
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx`
- Estados de UI: criar, editar, excluir e listar paineis customizados no modal
- Regras de exibicao/erro: falhas de API devem aparecer com detalhe retornado pelo backend

## 5) Compatibilidade e rollout

- Backward compatibility: mantida para paineis seedados e aplicacao de exames existente.
- Feature flag (se houver): nao.
- Estrategia de rollback: reverter commit do CRUD e voltar ao comportamento anterior sem paineis customizados funcionais.

## 6) Criterios de aceitacao (CA)

- CA-001: criar painel customizado com pelo menos um exame retorna sucesso no backend.
- CA-002: editar painel customizado altera nome/categoria/itens corretamente.
- CA-003: excluir painel customizado remove-o da listagem ativa sem afetar seedados.
- CA-004: `npm run build` do frontend continua passando.
- CA-005: o modal mostra mensagem real da API em caso de erro.

## 7) Casos de borda

- CB-001: payload sem exames deve retornar erro 422 claro.
- CB-002: tentativas de editar/excluir painel nao customizado devem ser rejeitadas.

## 8) Fora de escopo

- Ownership por usuario/clinica usando `created_by`.
- Refatoracao tipada completa do modal de paineis.
