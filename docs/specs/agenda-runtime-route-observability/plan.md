# Plano — PERF-21: observabilidade por subrota da Agenda

1. Reusar o classificador de rotas exatas `GET` e ampliar seu limite de cinco
   para dez caminhos.
2. Configurar separadamente lista, relacionados, resumo financeiro,
   configuração e stream da Agenda, preservando Ordens e Cobranças.
3. Contabilizar uma consulta a cada término ou falha de execução SQL dentro do
   contexto monitorado.
4. Persistir a contagem por amostra com migração aditiva e idempotente; calcular
   o tempo de aplicação como `total - banco - pool`, limitado a zero.
5. Expor p95 e média da contagem e do tempo de aplicação no resumo em memória e
   persistido, exibindo os p95 no painel administrativo.
6. Validar classificação, privacidade, migração, agregação, frontend e SDD antes
   de preparar qualquer publicação.
