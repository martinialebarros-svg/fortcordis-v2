# Plan - dashboard-persistent-shell-performance

Data: 2026-08-31  
Responsavel: Codex / equipe FortCordis  
Status: em andamento

## Etapas

1. Mapear as paginas que usam `DashboardLayout` e declarar explicitamente as familias de rotas autenticadas.
2. Extrair o frame atual para um componente interno reutilizavel e montá-lo no layout raiz somente nessas rotas.
3. Manter `DashboardLayout` como adaptador para as paginas existentes: dentro do shell persistente ele apenas devolve `children`; fora dele conserva o comportamento legado.
4. Cobrir a classificacao de rotas com teste unitario, executar lint, testes, build e guardrail SDD.
5. Validar em stage a navegacao entre Dashboard, Agenda, Atendimento e Financeiro, incluindo sidebar e bibliotecas auxiliares.

## Rollback

Reverter o commit da feature restaura o wrapper por pagina sem migracao de dados ou alteracao de API.
