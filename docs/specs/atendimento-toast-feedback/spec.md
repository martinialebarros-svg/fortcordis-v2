# Spec - atendimento-toast-feedback

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Padronizar feedback visual da tela de atendimento para que sucesso e erro usem o mesmo padrao de toast/popup no canto superior direito. A entrega cobre comportamento de exibicao, fechamento manual, auto-dismiss e prevencao de mensagens antigas persistirem indevidamente.

## 2) Requisitos funcionais (RF)

- RF-001: mensagens de sucesso em `atendimento/page.tsx` devem ser exibidas via toast popup (nao por banner fixo no topo da pagina).
- RF-002: mensagens de erro devem manter popup com destaque e botao de fechar.
- RF-003: novo toast de sucesso deve ter auto-dismiss configuravel (padrao: 4s a 6s).
- RF-004: novo toast de erro deve manter auto-dismiss maior (padrao: 8s) e fechamento manual.
- RF-005: quando nova mensagem substituir a anterior, timeout antigo deve ser limpo para evitar race conditions.
- RF-006: limpeza de timers deve ocorrer no unmount do componente para evitar memory leak.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (usabilidade): feedback de sucesso/erro deve ser perceptivel sem necessidade de rolar a pagina.
- NFR-002 (confiabilidade): nenhuma mensagem deve permanecer presa apos navegacao ou troca de contexto.
- NFR-003 (consistencia): sucesso e erro devem seguir padrao visual unico de notificacao.

## 4) Contratos tecnicos

### API

- Endpoint: sem alteracao.
- Metodo: sem alteracao.
- Payload: sem alteracao.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx`.
- Estados de UI:
- manter `erro` e `sucesso` como fonte de mensagem.
- adicionar estado popup para sucesso (ex.: `sucessoPopup`) e timer dedicado.
- Regras de exibicao/erro:
- erro em toast vermelho com `X` para fechar e auto-dismiss.
- sucesso em toast verde com `X` para fechar e auto-dismiss.
- remover bloco estatico de sucesso no topo.

## 5) Compatibilidade e rollout

- Backward compatibility: fluxo funcional da tela permanece igual; muda apenas forma de feedback visual.
- Feature flag (se houver): nao.
- Estrategia de rollback: revert do commit frontend e retorno ao banner de sucesso anterior.

## 6) Criterios de aceitacao (CA)

- CA-001: ao salvar atendimento com sucesso, toast verde aparece no canto superior direito.
- CA-002: ao gerar erro (ex.: upload invalido), toast vermelho aparece no canto superior direito.
- CA-003: toasts desaparecem automaticamente no tempo configurado e podem ser fechados manualmente.
- CA-004: ao disparar mensagens em sequencia, apenas a mensagem mais recente permanece visivel.
- CA-005: nenhum warning de lint/typescript introduzido na tela de atendimento.

## 7) Casos de borda

- CB-001: sucesso seguido de erro em menos de 1s.
- CB-002: erro seguido de sucesso em menos de 1s.
- CB-003: usuario fecha toast manualmente enquanto timer ainda esta ativo.

## 8) Fora de escopo

- Criar provider global de toast para toda aplicacao.
- Migrar outras telas (agenda, financeiro, laudos) para mesmo padrao neste ciclo.
