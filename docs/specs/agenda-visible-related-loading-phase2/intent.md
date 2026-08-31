# Intent - agenda-visible-related-loading-phase2

Data: 2026-08-30

Responsavel: Codex / equipe FortCordis

Status: in_progress

## 1) Problema atual

A entrada de `/agenda` busca catalogos completos de clinicas e servicos, mesmo sem interacao com os filtros. Quando ha agendamentos no periodo, a lista e o FullCalendar tambem buscam ate 1000 laudos, 2000 ordens de servico, 1000 clinicas e 2000 tutores para depois descartar no navegador os registros que nao pertencem aos itens visiveis.

## 2) Objetivo

Implementar o PERF-08: limitar os dados relacionados aos IDs dos agendamentos retornados pela pagina e carregar cada catalogo de filtro somente na primeira interacao que realmente o exige.

## 3) Nao objetivos

- Alterar regras de Agenda, laudos, ordens de servico, rotas ou pagamentos.
- Paginar os catalogos do modal `Novo Agendamento`; eles ja sao carregados somente quando o modal abre.
- Criar cache com validade entre rotas; isso permanece no PERF-10.
- Alterar indices ou executar `EXPLAIN ANALYZE`; isso permanece no PERF-13.
- Publicar em producao sem aceite separado depois de stage.

## 4) Contexto e restricoes

- A resposta agregada deve exigir autenticacao e aceitar no maximo 100 IDs positivos e unicos.
- Laudos e OS devem manter a semantica atual: o maior ID por agendamento (e por tipo, no caso de laudo) prevalece.
- Enderecos de clinica e tutor continuam necessarios para os atalhos de rota.
- Falha dos dados relacionados nao pode impedir que a lista principal apareca.
- Filtro que falhar ao carregar deve permitir nova tentativa na proxima interacao.

## 5) Impacto esperado

- A entrada sem uso dos filtros deixa de solicitar `/clinicas?limit=1000` e `/servicos?limit=1000`.
- Um periodo com agendamentos troca quatro varreduras HTTP de catalogos por uma leitura agregada limitada aos IDs recebidos.
- O payload relacionado passa a conter somente resumos e enderecos usados pela lista e pelo FullCalendar.

## 6) Definition of Ready

- [x] Escopo vinculado ao PERF-08.
- [x] Leituras excessivas identificadas no frontend.
- [x] Contrato agregado e limite de IDs definidos.
- [x] Rollback sem migracao definido.
