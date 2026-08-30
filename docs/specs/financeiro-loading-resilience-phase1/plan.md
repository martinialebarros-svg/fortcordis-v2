# Plan - financeiro-loading-resilience-phase1

Data: 2026-08-26

Responsavel: Codex / equipe FortCordis

Status: done

## 1) Sequencia da Fase 1

1. Definir politica de timeout para leituras JSON idempotentes.
2. Extrair orquestrador testavel de carga por secao.
3. Cancelar a carga anterior do Financeiro em mudanca de filtro/desmontagem.
4. Separar carregamento de transacoes e ordens e aceitar resultados parciais.
5. Exibir falhas por secao com acao manual de nova tentativa.
6. Executar testes, lint, build e guardrail SDD.
7. Publicar branch e PR colaborativo, sem merge/deploy automatico.

## 2) Tarefas

- [x] T1.1 Aplicar timeout de 15 s a GET/HEAD/OPTIONS/TRACE JSON sem override.
- [x] T1.2 Excluir blobs/arraybuffers/streams e mutacoes dessa politica.
- [x] T1.3 Adicionar helper para sucesso, falha e cancelamento de uma secao.
- [x] T1.4 Usar `AbortController` para invalidar a carga anterior.
- [x] T1.5 Separar os estados de carga de transacoes e ordens.
- [x] T1.6 Exibir lista de secoes indisponiveis e botao `Tentar novamente`.
- [x] T1.7 Cobrir timeout/orquestrador com testes automatizados.
- [x] T1.8 Validar build e SDD guardrail.

## 3) Criterio de conclusao

- A chamada mais lenta nao impede uma secao ja concluida de aparecer.
- Uma leitura JSON pendente termina em ate 15 segundos, salvo override explicito.
- Carga cancelada nao escreve estado nem cria aviso falso.
- Falha parcial permanece visivel e recuperavel.
- Suites focadas, lint, build e guardrail passam.

## 4) Risco e rollback

- Risco: timeout revelar endpoints que hoje demoram mais de 15 segundos.
- Mitigacao: aviso parcial, tentativa manual e telemetria posterior.
- Rollback: reverter o commit da fase; nenhum schema ou contrato de API e alterado.

## 5) Dependencias e bloqueios

- Dependencia: Axios 1.x e suporte de `AbortSignal` nos navegadores atuais.
- Bloqueio de release: reconciliar `origin/stage` com os tres commits presentes apenas em `origin/main` antes de promocao.
