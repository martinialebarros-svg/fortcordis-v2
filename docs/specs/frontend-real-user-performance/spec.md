# Spec - frontend-real-user-performance

## Requisitos funcionais

- RF-001: o navegador mede `shell_ms`, do inicio da navegacao ate a rota ser
  pintada, e `content_ms`, ate a carga principal ser sinalizada como concluida.
- RF-002: a primeira entrega cobre as rotas exatas `/dashboard`,
  `/atendimento`, `/laudos` e `/configuracoes`; query strings sao removidas e
  subrotas com IDs ficam fora da coleta ate receberem um sinal de prontidao
  proprio.
- RF-003: cada amostra informa apenas rota agrupada, navegacao `initial` ou
  `client`, desfecho `ready`, `partial`, `error`, `timeout` ou `cancelled` e os
  tempos em milissegundos.
- RF-004: a coleta marca timeout depois de 30 segundos e cancela a medicao
  anterior quando outra rota monitorada assume a navegacao.
- RF-005: `POST /api/v1/observability/frontend-performance` exige sessao ativa,
  valida o contrato e atribui o release no servidor.
- RF-006: `GET /api/v1/admin/observability/frontend-performance` exige papel
  `admin` e retorna somente agregados por rota, release e tipo de navegacao.
- RF-007: Configuracoes > Desempenho exibe amostras, p50/p95/p99 de shell e
  conteudo, maximo de conteudo e contagens de timeout, cancelamento, parcial e
  erro.

## Requisitos nao funcionais

- RNF-001: nenhuma amostra persiste URL completa, query string, IDs, usuario,
  paciente, tutor, clinica, payload clinico ou financeiro.
- RNF-002: falha de envio ou persistencia da telemetria nao bloqueia nem exibe
  erro ao usuario da pagina medida.
- RNF-003: duracoes aceitas ficam entre 0 e 120 segundos e `content_ms`, quando
  presente, nao pode ser menor que `shell_ms`.
- RNF-004: a retencao acompanha a janela limitada da telemetria HTTP e a
  consulta administrativa tem limite de amostras.
- RNF-005: a migracao e aditiva e idempotente em SQLite e PostgreSQL.

## Criterios de aceitacao

- CA-001: rotas fora da lista fechada e campos invalidos sao rejeitados.
- CA-002: a linha persistida contem somente os campos agregaveis definidos.
- CA-003: a agregacao calcula p50/p95/p99, maximo e contagens de desfecho por
  rota, release e tipo de navegacao.
- CA-004: troca de rota encerra a amostra anterior como `cancelled`; ausencia de
  prontidao por 30 segundos gera `timeout`.
- CA-005: as quatro paginas prioritarias sinalizam prontidao apenas depois de
  encerrarem sua carga principal.
- CA-006: o painel administrativo distingue telemetria de API e do navegador.
