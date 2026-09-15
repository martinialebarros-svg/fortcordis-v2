# Plan - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19 (revisado em 2026-08-26)
Status: implementacao

1. Reconciliar no frontend a exclusao de um exame removido durante o primeiro save.
2. Bloquear de forma sincrona nova inclusao do mesmo exame de catalogo na tela, inclusive em clique duplo antes da renderizacao.
3. Ignorar atualizacao atrasada que cite um `id` de exame que ja nao existe.
4. Cobrir as corridas com testes unitarios de frontend e backend, seguido de typecheck, lint e build.
5. Correlacionar a linha local pelo `_localId` com o registro criado a partir do
   snapshot enviado, mesmo se o nome mudar durante o round-trip.
6. Manter a chave React baseada no `_localId` depois da incorporacao do `id`,
   preservando foco e cursor.
7. Converter em `_destroy` o esvaziamento de uma solicitacao manual persistida
   somente quando ela nao tiver catalogo, painel, resultado, observacao, preparo
   ou anexo.
