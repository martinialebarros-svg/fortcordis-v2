# Spec - atendimento-upload-progress

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Evoluir UX de upload de anexos na tela de atendimento para exibir progresso durante envio e reforcar bloqueio de acao no contexto do upload em andamento. A entrega cobre upload geral e upload de resultado de exame, mantendo regras de validacao ja existentes.

## 2) Requisitos funcionais (RF)

- RF-001: ao iniciar upload, a UI deve exibir progresso percentual com atualizacao progressiva (quando metrica de progresso estiver disponivel).
- RF-002: o botao de envio do contexto ativo deve ficar desabilitado ate conclusao (sucesso ou erro).
- RF-003: durante upload, deve existir feedback textual claro (ex.: `Enviando 37%`).
- RF-004: ao concluir com sucesso, progresso deve ser resetado e mensagem de sucesso atual deve ser mantida.
- RF-005: ao falhar, progresso deve ser resetado e mensagem de erro atual deve ser mantida.
- RF-006: se `total` de bytes nao estiver disponivel, UI deve cair para estado de loading indeterminado sem quebrar fluxo.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (usabilidade): usuario deve perceber que o upload esta ativo em ate 1s apos clique.
- NFR-002 (confiabilidade): nenhum estado de progresso deve permanecer preso apos `finally`.
- NFR-003 (observabilidade): erros de upload continuam com detalhe vindo do backend quando disponivel.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/atendimentos/{id}/anexos/upload` (sem alteracao).
- Metodo: `POST` multipart/form-data.
- Payload: sem alteracao (`arquivo`, `tipo`, `descricao`, `exame_id?`).
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx`.
- Estados de UI:
- manter `uploadingAttachmentKey`.
- adicionar estado para progresso por contexto (ex.: `uploadProgressByKey`).
- Regras de exibicao/erro:
- mostrar porcentagem apenas quando `progressEvent.total` existir e for > 0.
- fallback para spinner/texto indeterminado quando nao houver `total`.
- reset de progresso no `finally`.

## 5) Compatibilidade e rollout

- Backward compatibility: sem impacto em backend/API e contratos persistentes.
- Feature flag (se houver): nao.
- Estrategia de rollback: revert do commit frontend e retorno ao comportamento atual de loading simples.

## 6) Criterios de aceitacao (CA)

- CA-001: upload geral exibe progresso visual ate conclusao.
- CA-002: upload de resultado de exame exibe progresso visual ate conclusao.
- CA-003: botao de envio do contexto ativo fica desabilitado durante upload e reabilita ao final.
- CA-004: em erro de upload, progresso zera e mensagem de erro continua visivel em toast.
- CA-005: lint da tela de atendimento permanece sem warnings/erros.

## 7) Casos de borda

- CB-001: `progressEvent.total` ausente ou zero.
- CB-002: upload muito rapido (100% quase instantaneo).
- CB-003: erro de rede apos progresso parcial.

## 8) Fora de escopo

- Upload multiplo simultaneo por lote.
- Pausar/cancelar upload manualmente.
