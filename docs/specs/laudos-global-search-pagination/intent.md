# Intent - laudos-global-search-pagination

Data: 2026-04-18  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

A tela de laudos exibe apenas o lote inicial retornado pela API e a busca funciona somente sobre os itens ja carregados no frontend. Como consequencia, laudos antigos deixam de ser encontrados por paciente, tutor, clinica ou data, mesmo existindo na base.

## 2) Objetivo

Permitir que a busca da tela de laudos consulte toda a base sem obrigar a listagem completa de todos os registros na abertura da pagina, preservando desempenho e encontrabilidade.

## 3) Nao objetivos

- Nao alterar o modelo de dados de laudos.
- Nao implementar busca avancada para exames neste ciclo.
- Nao remover a paginacao do endpoint.

## 4) Contexto e restricoes

- Restricoes tecnicas: a API de laudos ja possui paginacao e precisava continuar limitando a carga inicial.
- Restricoes de prazo: a correcao precisava ser pequena e segura para promover em `stage`.
- Restricoes regulatorio/operacional: a tela deve localizar historico clinico antigo com previsibilidade.

## 5) Impacto esperado

- Usuarios impactados: equipe operacional e medica que pesquisa historico de laudos.
- Modulos impactados: listagem de laudos no frontend e endpoint `GET /laudos` no backend.
- Risco de regressao: medio, por alterar filtros e contagem em tela sensivel de consulta.

## 6) Riscos iniciais

- Risco 1: busca por data nao reconhecer formatos usados no dia a dia.
- Risco 2: a tela continuar sugerindo total incorreto quando houver mais resultados que a primeira pagina.

## 7) Perguntas abertas

- Pergunta 1: sera necessario expandir a mesma estrategia de busca remota para a aba de exames?
- Pergunta 2: havera necessidade futura de filtros adicionais por status e tipo diretamente na UI?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
