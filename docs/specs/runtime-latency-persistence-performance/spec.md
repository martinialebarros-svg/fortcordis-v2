# Especificação — PERF-17: telemetria persistente de latência

## Dados coletados

Para cada requisição de um prefixo em `RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS`,
o sistema poderá registrar:

- prefixo normalizado configurado, nunca a URL solicitada;
- identificador curto do release em execução;
- código HTTP;
- duração total, duração acumulada de SQL e espera acumulada de pool, em ms;
- instante UTC da amostra.

Nenhum parâmetro de URL, payload, usuário, clínica, paciente, tutor ou texto
clínico pode ser persistido nessa tabela.

## Confiabilidade

- A escrita ocorre depois de produzir a resposta e usa sessão separada.
- Erro de telemetria é registrado localmente e não muda a resposta HTTP.
- A limpeza é executada de forma limitada e periódica durante escritas bem
  sucedidas, removendo somente amostras além da retenção configurada.
- SQLite continua sem `QueuePool`; o monitor de espera de pool só se aplica aos
  bancos que usam pool de conexões.

## Consulta administrativa

`GET /api/v1/admin/observability/http-latency?hours={1..168}` exige papel
`admin`. A resposta é agregada por `(endpoint, release_id)` e traz quantidade,
erros 5xx, média, p50, p95, p99, banco e pool. A consulta possui limite de
amostras e informa quando ele foi atingido.

## Identificação do release

O deploy grava o hash curto efetivamente instalado em
`RUNTIME_HTTP_LATENCY_RELEASE_ID`. Se indisponível, a API informa `unknown`,
sem inferir ou expor metadados de repositório ao cliente.
