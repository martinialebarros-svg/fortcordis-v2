# Plano — PERF-19: latência de Ordens e Cobranças

1. Manter os cinco prefixos operacionais existentes e acrescentar uma lista
   limitada de rotas exatas de leitura.
2. Configurar como rotas exatas `GET /api/v1/ordens-servico` e
   `GET /api/v1/ordens-servico/cobrancas`.
3. Propagar o método HTTP no middleware para não classificar uma mutação futura
   no mesmo caminho como leitura financeira.
4. Reusar persistência, retenção, agregação administrativa e painel existentes,
   sem migração de banco ou novo payload público.
5. Cobrir separação das métricas, exclusão de subrotas/mutações, limites e
   regressão do monitor atual com testes automatizados.
6. Em stage, confirmar os sete grupos ativos e coletar uma janela autenticada
   somente leitura; produção depende da promoção exata do snapshot validado.
