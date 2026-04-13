# Spec - frontend-performance-agenda-atendimento

Data: 2026-04-13  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

O ciclo cobre a reducao de bundle inicial das rotas `agenda/fullcalendar` e `atendimento`, com uso de `dynamic import`, extracao de blocos da tela de atendimento para componentes sob demanda, configuracao de analyzer de bundle e documentacao de leitura de performance. A entrega preserva fluxos existentes e nao altera contratos de backend.

## 2) Requisitos funcionais (RF)

- RF-001: a rota `agenda/fullcalendar` deve carregar o ecossistema de calendario sob demanda, reduzindo o peso inicial da pagina.
- RF-002: a rota `atendimento` deve ser quebrada em componentes menores, com carregamento lazy para workspaces e modais opcionais.
- RF-003: o frontend deve oferecer um fluxo de analise de bundle reproducivel via `npm run analyze`.
- RF-004: o codigo legado desativado atras de `false ? (` no `atendimento/page.tsx` deve ser removido ao final da modularizacao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): `agenda/fullcalendar` deve reduzir o `First Load JS` de forma perceptivel em relacao ao baseline local.
- NFR-002 (seguranca/permissoes): nenhuma mudanca de permissao, autenticacao ou contrato de sessao deve ser introduzida.
- NFR-003 (observabilidade): a equipe deve conseguir inspecionar peso de rota e bibliotecas com `next build` e bundle analyzer.

## 4) Contratos tecnicos

### API

- Endpoint: sem novos endpoints.
- Metodo: sem alteracao.
- Payload: sem alteracao.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/agenda/fullcalendar/page.tsx`, `frontend/app/agenda/page.tsx`, `frontend/app/atendimento/page.tsx` e componentes extraidos em `frontend/app/atendimento/components/`.
- Estados de UI: carregamento lazy de calendario, modais, preview, documentos, exames, prescricao, triagem, cadastro complementar e bibliotecas.
- Regras de exibicao/erro: manter os mesmos fluxos visiveis ao usuario, com carga sob demanda sem tela branca e sem perda de funcionalidade.

## 5) Compatibilidade e rollout

- Backward compatibility: mantida; mesma navegacao, mesmos fluxos e mesmas chamadas existentes.
- Feature flag (se houver): nao.
- Estrategia de rollback: reverter o commit de performance no frontend e restaurar a versao monolitica anterior.

## 6) Criterios de aceitacao (CA)

- CA-001: `npm run build` compila o frontend sem erros apos a modularizacao.
- CA-002: `agenda/fullcalendar` reduz de `243 kB` para aproximadamente `154 kB` de `First Load JS`.
- CA-003: `atendimento` reduz de `200 kB` para aproximadamente `177 kB` de `First Load JS`.
- CA-004: smoke tests de agenda e atendimento passam sem regressao funcional perceptivel.
- CA-005: o `page.tsx` de atendimento fica sem blocos mortos remanescentes usando `false ? (`.

## 7) Casos de borda

- CB-001: componentes lazy precisam continuar abrindo corretamente apenas quando o workspace correspondente e ativado.
- CB-002: preview de PDF, anexos e modais de exames nao podem depender de imports globais carregados antes da hora.

## 8) Fora de escopo

- Otimizacao de `First Load JS shared by all`.
- Refatoracao tipada completa dos props dos componentes extraidos.
