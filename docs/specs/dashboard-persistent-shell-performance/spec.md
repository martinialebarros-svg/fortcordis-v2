# Spec - dashboard-persistent-shell-performance

Data: 2026-08-31  
Responsavel: Codex / equipe FortCordis  
Status: em andamento

## Requisitos funcionais

- RF-001: `DashboardShell` deve envolver somente familias de rotas autenticadas declaradas explicitamente.
- RF-002: em navegacao entre essas rotas, a instancia de autenticacao, branding, push, alertas e `FortinhoProvider` deve permanecer montada.
- RF-003: os 35 usos existentes de `DashboardLayout` devem continuar renderizando o conteudo sem um segundo shell quando o shell persistente estiver ativo.
- RF-004: fora do shell persistente, `DashboardLayout` deve manter o comportamento anterior para compatibilidade incremental.
- RF-005: rotas publicas e nomes apenas semelhantes, como `/agendado`, nao devem receber autenticacao ou sidebar do dashboard.

## Requisitos nao funcionais

- NFR-001: nenhuma chamada de API, payload ou regra de autorizacao e alterada.
- NFR-002: a lista de rotas e testavel como funcao pura, com correspondencia exata de fronteira (`/agenda` versus `/agendado`).
- NFR-003: o shell deve continuar fechando a sidebar em navegacao mobile por meio de `usePathname`.

## Criterios de aceitacao

- CA-001: Dashboard, Agenda, Atendimento, Laudos e Financeiro pertencem ao shell persistente; login e portais publicos nao.
- CA-002: lint, testes e build do frontend concluem sem falhas.
- CA-003: o guardrail SDD reconhece os quatro artefatos desta feature.
- CA-004: em stage, a navegacao autenticada entre modulos mostra uma unica sidebar e nenhum erro de carregamento das bibliotecas auxiliares.

## Rollout

Entrega inicialmente para `stage`. A promocao para producao depende de workflow terminal e smoke autenticado do shell.
