# Spec - atendimento-upload-cancel-retry

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Adicionar controle de cancelamento do upload em andamento no fluxo de anexos gerais e anexos de exame. A UI deve permitir interromper envio ativo, limpar estado de progresso/trava e manter arquivo selecionado para nova tentativa imediata.

## 2) Requisitos funcionais (RF)

- RF-001: enquanto um upload estiver ativo, deve haver acao explicita de `Cancelar upload` no contexto ativo.
- RF-002: ao cancelar, a requisicao HTTP deve ser abortada no cliente.
- RF-003: ao cancelar, estado de loading/progresso deve ser limpo e botoes devem voltar a habilitar.
- RF-004: apos cancelamento, arquivo selecionado deve permanecer no draft para reenvio rapido.
- RF-005: cancelamento deve gerar feedback visivel (`Upload cancelado.`).
- RF-006: sucesso/erro de upload continuam com comportamento atual de toast.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (usabilidade): acao de cancelamento deve ficar visivel no mesmo card do upload ativo.
- NFR-002 (confiabilidade): nenhum controlador de abort deve ficar pendente apos `finally`.
- NFR-003 (observabilidade): erro de cancelamento nao deve mascarar erro real de backend quando a requisicao falhar sem cancelamento.

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
- Estados de UI:
- adicionar mapa de `AbortController` por `uploadKey`.
- manter `uploadingAttachmentKey` e `uploadProgressByKey`.
- Regras de exibicao/erro:
- exibir `Cancelar upload` apenas para o `uploadKey` ativo.
- tratar `ERR_CANCELED` sem exibir erro vermelho.

## 5) Compatibilidade e rollout

- Backward compatibility: sem impacto em backend e contratos persistentes.
- Feature flag (se houver): nao.
- Estrategia de rollback: revert do commit frontend.

## 6) Criterios de aceitacao (CA)

- CA-001: upload geral em andamento pode ser cancelado pelo botao e retorna ao estado pronto para reenvio.
- CA-002: upload de exame em andamento pode ser cancelado pelo botao e retorna ao estado pronto para reenvio.
- CA-003: cancelar remove barra/progresso e reabilita controles sem refresh de pagina.
- CA-004: arquivo selecionado permanece apos cancelamento.
- CA-005: lint da tela de atendimento sem warnings/erros.

## 7) Casos de borda

- CB-001: cancelar upload muito rapido (logo apos iniciar).
- CB-002: cancelar quando progresso ainda esta indeterminado (`total` ausente).
- CB-003: clicar cancelar duas vezes em sequencia.

## 8) Fora de escopo

- Retentativa automatica com backoff.
- Cancelamento em lote de uploads multiplos.
