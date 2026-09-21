# Plan - agenda-progressive-loading

Data: 2026-09-21

Responsavel: Codex / equipe FortCordis

Status: ready_for_stage

## 1) Sequencia da entrega

1. Separar a conclusao da lista principal das leituras auxiliares.
2. Evitar a segunda carga do resumo na entrada e na troca de periodo.
3. Manter a renovacao do resumo depois de acoes operacionais e atualizacao manual.
4. Descartar respostas obsoletas da lista, dos relacionados e do resumo.
5. Cobrir o executor paralelo com testes e validar lint, tipos, build e guardrail SDD.
6. Publicar em stage e executar smoke autenticado somente leitura.

## 2) Criterio de conclusao

- A carga principal nao aguarda relacionados ou resumo financeiro.
- Leituras auxiliares iniciam juntas e falham de forma independente.
- Mudanca de periodo nao duplica a chamada do resumo.
- Resposta antiga nao vence uma requisicao mais recente.
- Testes, lint, typecheck, build e guardrail SDD passam.
- Stage exibe a Agenda sem erro funcional visivel.

## 3) Risco e rollback

- Risco: o resumo financeiro nao ser renovado depois de uma acao operacional.
- Mitigacao: manter `includeResumo=true` nas cargas manuais e posteriores a mutacoes; desativar somente na carga dirigida pelo efeito de periodo.
- Risco: atalhos relacionados aparecerem alguns instantes depois da lista.
- Mitigacao: preservar o estado independente ja existente e ignorar somente respostas obsoletas.
- Rollback: reverter o commit desta fatia; nao ha migracao nem escrita de dados.
