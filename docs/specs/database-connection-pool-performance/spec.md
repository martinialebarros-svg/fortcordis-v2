# Especificacao - PERF-14: pool de conexoes resiliente

## Escopo

Configurar o engine SQLAlchemy principal do backend para PostgreSQL com pool
finito, `pool_pre_ping`, reciclagem e timeouts de pool e conexao.

## Requisitos

- RF-001: PostgreSQL deve usar `pool_size=5` e `max_overflow=5` por processo,
  configuraveis por ambiente.
- RF-002: conexoes reutilizadas devem passar por `pool_pre_ping` por padrao.
- RF-003: a espera por conexao do pool deve terminar em 15 segundos por padrao.
- RF-004: o handshake de conexao deve terminar em 10 segundos por padrao.
- RF-005: conexoes devem ser recicladas apos 1800 segundos por padrao.
- RF-006: SQLite deve manter somente `check_same_thread=False`, sem opcoes de
  pool PostgreSQL.
- RF-007: valores invalidos de capacidade e timeout devem ser rejeitados na
  configuracao.

## Fora de escopo

- Alterar topologia de workers (PERF-15).
- HTTP/2 (PERF-16).
- Persistir p50/p95/p99, tempo de banco ou espera de pool (PERF-17).


## Orcamento operacional de producao — 2026-10-15

- RF-008: no projeto Supabase de producao em session mode, o teto agregado
  configurado da VPS fica abaixo das 15 sessoes observadas: API 3, worker 3
  (`DATABASE_POOL_SIZE=3`, `DATABASE_MAX_OVERFLOW=0`) e Node 2
  (`WHATSAPP_DATABASE_POOL_MAX=2`), total 8. Os defaults de desenvolvimento
  permanecem 5+5; stage usa outro projeto e nao recebe esta mudanca.
- RF-009: o preflight operacional reduz os limites antes do setup/migracoes,
  reinicia a API para liberar sockets antigos e aplica os demais limites no
  reinicio normal de worker/Node do deploy; preserva as outras chaves
  de ambiente e backups protegidos, sem imprimir credenciais.
- RF-010: readiness, canario autenticado e rollback continuam obrigatorios.
  Reduzir pools nao autoriza trocar session mode por transaction mode,
  encerrar sessoes arbitrarias ou desabilitar gates.

## Ciclo de conexoes da Agenda — 2026-10-15

- RF-011: a verificacao de tabelas de bloqueios e de atendimentos vinculados
  da Agenda deve reutilizar a conexao da sessao atual. Uma requisicao que ja
  ocupa a ultima conexao disponivel nao pode solicitar outra apenas para
  introspeccao. Preservar o cache de disponibilidade por sessao, os bloqueios
  ativos e as restricoes de conclusao/reabertura de atendimento vinculado.
- RF-012: a compatibilidade de colunas georreferenciadas na busca de tutores
  deve usar a mesma conexao da autenticacao/consulta, preservando o suporte
  legado e a idempotencia, sem alterar o schema atual.
- RF-013: o SSE `/api/v1/agenda/stream` deve autenticar e autorizar pela mesma
  matriz vigente, copiar somente o ID necessario ao evento `connected` e
  liberar a sessao de banco antes de manter o canal aberto. O gerador nao
  pode acessar objetos ORM nem reabrir a conexao durante eventos/keep-alive.
- RF-014: manter os contratos dos eventos, o descarte do subscriber ao
  desconectar e as respostas 401/403 de autenticacao/permissao. Abrir varios
  streams nao deve impedir consultas HTTP autenticadas com pool limitado.
- RF-015: a correcao nao altera o orcamento 3+3+2 de producao, regras de
  disponibilidade, deslocamento, preferencia de horario ou aceite humano.
