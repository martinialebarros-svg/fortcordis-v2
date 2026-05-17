# Spec - arch-fe-02-padronizar-cliente-api-erros-for40

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## 1) Escopo funcional

Padronizar o cliente HTTP do frontend e o tratamento de erros para reduzir duplicacao, melhorar consistencia de mensagens para o usuario e facilitar manutencao.

## 2) Requisitos funcionais (RF)

- RF-001: centralizar extracao de mensagens de erro de API em utilitario compartilhado.
- RF-002: atualizar interceptor de resposta do cliente Axios para anexar mensagem normalizada no objeto de erro.
- RF-003: migrar modulos prioritarios para usar o padrao unificado de erro (atendimento e telas de servicos/transacao).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): sem impacto perceptivel em latencia da UI.
- NFR-002 (seguranca/permissoes): sem alteracao de ACL/permissoes.
- NFR-003 (observabilidade): erros ficam mais rastreaveis e padronizados no frontend.

## 4) Contratos tecnicos

### API

- Endpoint: sem novos endpoints.
- Metodo: sem alteracao.
- Payload: sem alteracao.
- Resposta: sem alteracao de contrato backend.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas:
  - `frontend/app/atendimento/page.tsx`
  - `frontend/app/servicos/novo/page.tsx`
  - `frontend/app/servicos/[id]/page.tsx`
  - `frontend/app/financeiro/TransacaoModal.tsx`
- Estados de UI: mensagens de erro passam a ser geradas pelo utilitario central.
- Regras de exibicao/erro: fallback consistente quando a API nao retorna `detail`.

## 5) Compatibilidade e rollout

- Backward compatibility: preservada.
- Feature flag (se houver): nao.
- Estrategia de rollback: reverter commit da padronizacao de cliente/erro.

## 6) Criterios de aceitacao (CA)

- CA-001: `npm run build` do frontend passa sem erro de tipo.
- CA-002: modulos migrados exibem erro usando utilitario compartilhado.
- CA-003: `sdd-guardrail` passa com artefatos SDD atualizados no ciclo.

## 7) Casos de borda

- CB-001: resposta de erro como string JSON serializada.
- CB-002: resposta de erro como `Blob` (download/PDF) com payload de erro.

## 8) Fora de escopo

- Migracao completa de todas as telas frontend neste ciclo.
- Reescrita de UX de notificacao (toast/alert) em todo o sistema.
