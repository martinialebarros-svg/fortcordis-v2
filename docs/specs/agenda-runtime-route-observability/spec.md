# Especificação — PERF-21: observabilidade por subrota da Agenda

## Contrato funcional

- RF-001: somente `GET` exato dos caminhos abaixo gera os respectivos grupos:
  - `/api/v1/agenda`;
  - `/api/v1/agenda/relacionados`;
  - `/api/v1/agenda/resumo-financeiro`;
  - `/api/v1/agenda/configuracao`;
  - `/api/v1/agenda/stream`.
- RF-002: detalhes, mutações e outras subrotas da Agenda não podem contaminar os
  cinco grupos exatos.
- RF-003: cada amostra registra a quantidade acumulada de consultas SQL da
  requisição monitorada.
- RF-004: a agregação retorna média e p95 da contagem de consultas e do tempo de
  aplicação, calculado por amostra como `max(0, total - banco - pool)`.
- RF-005: o painel administrativo exibe `App p95` e `Consultas p95` junto das
  métricas existentes.

## Configuração e persistência

- `RUNTIME_HTTP_LATENCY_EXACT_ENDPOINTS` aceita no máximo dez caminhos e emite
  aviso explícito ao truncar excedentes.
- A configuração padrão remove `/api/v1/agenda` dos prefixos amplos e mantém os
  quatro demais prefixos operacionais, evitando sobreposição e aviso permanente.
- O caminho exato prevalece sobre prefixo igual; nesse caso o prefixo é removido
  para impedir que detalhes e mutações caiam no grupo base.
- A migração `20260923_89` adiciona `database_query_count INTEGER NOT NULL
  DEFAULT 0` de forma aditiva e idempotente.
- Amostras antigas recebem contagem zero e continuam consultáveis.
- `application_ms` é derivado dos tempos já persistidos, sem coluna redundante.

## Privacidade e confiabilidade

- Persistir apenas rótulo fixo, release, status, tempos, contagem e instante UTC.
- Não persistir URL completa, query string, SQL, parâmetros, usuário, clínica,
  paciente, tutor ou conteúdo clínico.
- A escrita continua posterior à resposta, em sessão separada e tolerante a
  falhas.
- Uma consulta com erro conta uma vez quando o evento de falha do SQL encerra a
  medição.

## Critérios de aceitação

- CA-001: teste prova os cinco grupos exatos da Agenda e o isolamento de detalhe
  e mutação.
- CA-002: duas consultas somam contagem dois e produzem tempo de aplicação
  correto na amostra e na agregação.
- CA-003: migração é idempotente e preserva os índices existentes.
- CA-004: resumo persistido retorna p95 de consultas e aplicação sem campos
  sensíveis.
- CA-005: frontend compila e apresenta as duas novas colunas.
- CA-006: testes focados, suíte relevante, diff e guardrail SDD passam.
- CA-007: stage posterior coleta preferencialmente 100 amostras por rota com
  `truncated=false`, zero 5xx e release correspondente ao deploy.
