# Plan - financeiro-active-tab-loading-phase2

Data: 2026-08-29

Responsavel: Codex / equipe FortCordis

Status: done

## 1) Sequencia da entrega PERF-07

1. Extrair um plano puro e testavel de secoes por aba.
2. Resolver `aba` e `os_id` antes da primeira carga.
3. Orquestrar Transacoes e OS/catalogos apenas quando pertencem a aba ativa.
4. Representar contadores ainda nao carregados sem falso zero.
5. Cobrir os tres tipos de aba com testes automatizados.
6. Executar testes, lint, build e guardrail SDD.
7. Abrir PR para `stage`, sem merge ou deploy automatico.

## 2) Tarefas

- [x] T2.1 Definir o tipo de aba e o plano de carga por aba.
- [x] T2.2 Adiar a primeira carga ate os parametros da rota serem resolvidos.
- [x] T2.3 Evitar OS/clinicas/servicos na entrada de Transacoes.
- [x] T2.4 Carregar OS/clinicas/servicos em Cobrancas e Ordens.
- [x] T2.5 Cancelar carga anterior em alternancia de aba.
- [x] T2.6 Distinguir contador desconhecido de lista vazia confirmada.
- [x] T2.7 Executar validacoes e registrar evidencias.

## 3) Criterio de conclusao

- Entrada padrao em Transacoes nao solicita `/ordens-servico`, `/clinicas` nem `/servicos`.
- Links diretos para Cobrancas/Ordens solicitam essas secoes na primeira carga util.
- Alternancia rapida nao publica resposta da aba anterior.
- Testes, lint, build, diff check e guardrail SDD passam.

## 4) Risco e rollback

- Risco: primeira abertura das abas de OS passa a exibir carregamento que antes ocorria oculto.
- Mitigacao: manter indicador independente e timeout/recuperacao da Fase 1.
- Rollback: reverter o commit PERF-07; nao ha migracao ou mudanca de contrato.

## 5) Dependencias e bloqueios

- Dependencia: orquestrador cancelavel entregue na Fase 1.
- Bloqueio de producao: `origin/main` e `origin/stage` estao divergentes em 2026-08-29 e exigem reconciliacao antes de promocao.
