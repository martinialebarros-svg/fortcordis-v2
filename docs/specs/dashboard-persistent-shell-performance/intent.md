# Intent - dashboard-persistent-shell-performance

Data: 2026-08-31  
Responsavel: Codex / equipe FortCordis  
Status: em andamento

## Problema

As rotas autenticadas instanciam `DashboardLayout` dentro de cada pagina. Em navegacao cliente entre modulos, isso remonta o shell e repete a validacao de sessao, o carregamento de branding, o bootstrap de push e a consulta de alertas internos.

## Objetivo

Montar um unico shell persistente para as rotas autenticadas suportadas, preservando autenticacao, branding, push, alertas, sidebar, logout e `FortinhoProvider` durante a navegacao entre esses modulos.

## Fora de escopo

- Alterar contratos de autenticacao, push ou alertas.
- Converter rotas publicas, portais ou login para o shell autenticado.
- Reescrever as paginas de modulo ou mudar URLs.

## Riscos

- Uma classificacao incorreta de rota pode aplicar o shell a uma pagina publica.
- Contextos existentes do shell podem deixar de estar disponiveis se os wrappers legados forem removidos sem compatibilidade.
- Persistir o shell nao pode manter estado clinico ou financeiro especifico da pagina anterior.
