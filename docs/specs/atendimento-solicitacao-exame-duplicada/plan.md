# Plan - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19
Status: implementacao

1. Reconciliar no frontend a exclusao de um exame removido durante o primeiro save.
2. Bloquear de forma sincrona nova inclusao do mesmo exame de catalogo na tela, inclusive em clique duplo antes da renderizacao.
3. Ignorar atualizacao atrasada que cite um `id` de exame que ja nao existe.
4. Cobrir as corridas com testes unitarios de frontend e backend, seguido de typecheck, lint e build.
