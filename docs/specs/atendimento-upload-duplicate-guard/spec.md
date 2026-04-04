# Spec - atendimento-upload-duplicate-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Adicionar protecao de deduplicacao no cliente para impedir upload repetido equivalente enquanto a primeira tentativa estiver ativa. A protecao deve atuar em upload geral e por exame, limpar assinatura ao finalizar (sucesso/erro/cancelamento) e preservar comportamento atual de progresso/cancelamento.

## 2) Requisitos funcionais (RF)

- RF-001: antes de iniciar upload, gerar assinatura por contexto e metadados do arquivo.
- RF-002: se assinatura equivalente ja estiver em andamento, bloquear nova tentativa sem chamar API.
- RF-003: ao bloquear duplicado, exibir aviso neutro (`Upload ja esta em andamento para este arquivo.`).
- RF-004: ao finalizar upload (sucesso/erro/cancelamento), remover assinatura ativa para permitir nova tentativa.
- RF-005: regra deve funcionar para upload geral e upload por exame.
- RF-006: nao bloquear upload de arquivo diferente ou mesmo arquivo em contexto diferente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (confiabilidade): nenhuma assinatura ativa deve ficar presa apos `finally`.
- NFR-002 (usabilidade): bloqueio de duplicidade deve ser perceptivel e compreensivel para usuario.
- NFR-003 (performance): verificacao de duplicidade deve ser O(1) por tentativa.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/atendimentos/{id}/anexos/upload` (sem alteracao).
- Metodo: `POST` multipart/form-data.
- Payload: sem alteracao.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx`.
- Estados/refs de UI:
- adicionar estrutura em memoria para assinaturas de upload em andamento (ex.: `Set<string>` em `useRef`).
- Regras de exibicao/erro:
- tentativa duplicada nao dispara erro vermelho.
- progresso/cancelamento existentes permanecem ativos.

## 5) Compatibilidade e rollout

- Backward compatibility: sem impacto de contrato com backend.
- Feature flag (se houver): nao.
- Estrategia de rollback: revert do commit frontend.

## 6) Criterios de aceitacao (CA)

- CA-001: double-click no envio geral nao gera dois POSTs equivalentes.
- CA-002: double-click no envio de exame nao gera dois POSTs equivalentes.
- CA-003: apos sucesso/erro/cancelamento, novo envio do mesmo arquivo volta a funcionar.
- CA-004: aviso neutro aparece quando tentativa duplicada e bloqueada.
- CA-005: lint da tela segue sem warnings/erros.

## 7) Casos de borda

- CB-001: clique duplo muito rapido antes de render de estado.
- CB-002: tentativa duplicada durante progresso indeterminado.
- CB-003: cancelar upload e reenviar imediatamente.

## 8) Fora de escopo

- Dedupe transacional no backend.
- Bloqueio cross-tab entre varias abas do navegador.
