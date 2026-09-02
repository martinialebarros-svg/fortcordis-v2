# Plano de entrega da PERF-15

1. Reunir a inicializacao e a parada dos jobs persistidos e agendadores em um
   ciclo de vida reutilizavel.
2. Criar um ponto de entrada Python para o processo `worker`, com tratamento de
   `SIGTERM` e parada ordenada.
3. Fazer a API iniciar esses trabalhos apenas no papel local `all`; em VPS ela
   recebe explicitamente o papel `api`.
4. Provisionar a unidade `systemd` `<backend>-worker`, com o mesmo arquivo de
   ambiente e o papel `worker`, e validar que ela esta ativa no deploy.
5. Preservar rollback: ao voltar para uma versao sem worker dedicado, remover a
   unidade e o `drop-in` de papel antes de reiniciar a API.
6. Executar testes unitarios, verificacoes de sintaxe, guardrail SDD e a
   validacao de stage antes de qualquer promocao para producao.
