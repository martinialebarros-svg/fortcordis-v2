# Intent — PERF-19: latência de Ordens e Cobranças

## Problema

Depois da paginação remota de Ordens e Cobranças, as duas leituras críticas do
Financeiro ainda não aparecem isoladas na telemetria persistente. O monitor
existente reserva seus cinco prefixos para outras famílias; usar o prefixo amplo
de Ordens também misturaria listagem, detalhes, PDFs e mutações.

## Objetivo

Reaproveitar a telemetria first-party já existente para medir separadamente os
`GET` exatos de Ordens e Cobranças, com p50/p95/p99, SQL, pool, 5xx e release,
sem guardar query string, filtros, usuário ou conteúdo financeiro/clínico.

## Fora de escopo

- Adicionar fornecedor externo de observabilidade ou nova dependência.
- Medir Web Vitals, rede, hidratação ou renderização no navegador.
- Alterar consultas, paginação ou regras financeiras.
- Tornar a telemetria requisito para responder à requisição.
- Publicar ou promover a mudança sem validação posterior em stage.
