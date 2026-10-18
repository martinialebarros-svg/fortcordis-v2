# Spec - logistica-agenda-google-cost-control

## Evolução em 18/10/2026

O gate de lookup e o relatório legado não são tetos financeiros. A proteção efetiva passa a ser especificada em `../google-maps-enforced-budget/spec.md`, com autorização única por ação e ledger atômico no servidor. Consultas Google são recusadas quando não houver política e saldo verificáveis, inclusive com lookup ao vivo habilitado. Revalidação Google de rota expirada renova `updated_at` mesmo se distância/duração/fonte forem idênticas; ajustes manuais continuam protegidos.

Decisão posterior para produção: `operation_mode=cache_only` impõe zero envios Google independentemente de flags, chave, force refresh, políticas automáticas ou origem HTTP. Somente cache Google ainda válido ou override manual persistido/autorizado pode atender à rota. Miss, expiração e heurística retornam bloqueio `cache_only`; nenhuma duração, distância ou disponibilidade é fabricada. O cache Google exige TTL configurado positivo e timestamp válido; TTL zero/negativo, manual sem `manual_override=true` e cache de sessão da primeira saída sem timestamp/TTL são recusados. A leitura não renova TTL. Operações sem custo têm preview `required=false`, sem quote/grant pago; isso não autoriza chamadas futuras.

Em `cache_only`, limites de chamadas/BRL por ação/dia/mês são zero; preços, FX e baseline são omitidos do payload, e eventos/baseline existentes são preservados pelo servidor. `paid_budget` mantém os requisitos de reserva/consentimento e dados financeiros confiáveis. As regras históricas RF-002, CA-002 e CA-007 abaixo não autorizam heurística ou lookup ao vivo no novo modo. A validação operacional continua atômica, inclusive em IA e reativação de reservas.

Data: 2026-04-22  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

O ciclo endurece o controle de custo de Google Maps na agenda/logistica com cache de lookup por requisicao, gate opcional para refresh de heuristica com API key e preservacao do endpoint de cobertura da matriz.

## 2) Requisitos funcionais (RF)

- RF-001: loops da agenda devem reutilizar lookup de duracao para o mesmo par/perfil dentro da mesma requisicao.
- RF-002: heuristica local nao deve ser invalidada automaticamente apenas por haver API key, salvo quando habilitado via setting.
- RF-003: o endpoint `/logistica/cobertura-matriz` deve continuar disponivel.
- RF-004: incluir testes automatizados para gate de refresh e cache de lookup na agenda.
- RF-005: disponibilizar endpoint de leitura `/logistica/google-maps/custos-quotas` com `window_days`, `total_api_calls` e `cost_and_quotas`.
- RF-006: incluir `cost_and_quotas` em `/logistica/google-maps/resumo` para consumo direto pelo frontend.
- RF-007: introduzir setting `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ` para controlar lookup ao vivo na leitura de pares, com default seguro para compatibilidade.
- RF-008: introduzir setting `LOGISTICA_GOOGLE_TRAFFIC_AWARE` para controlar uso de trafego em Routes/Distance Matrix.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (custo): reduzir chamadas redundantes ao Google Maps.
- NFR-002 (compatibilidade): manter contratos de API existentes.
- NFR-003 (operacao): ajuste de refresh agressivo deve ser controlado por setting.
- NFR-004 (observabilidade financeira): relatorio de custo deve incluir estimativa por SKU e recomendacao de quotas.
- NFR-005 (confiabilidade de quota): recomendacao de limite por minuto deve refletir uso real, inclusive cenarios de baixo volume.

## 4) Contratos tecnicos

### Backend/configuracao

- Novo setting: `LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY` (default `False`).
- Novo setting: `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ` (default `True`).
- Novo setting: `LOGISTICA_GOOGLE_TRAFFIC_AWARE` (default `False`).

### API

- Sem mudanca de payload em agenda.
- Rota de leitura `/logistica/cobertura-matriz` mantida.
- Nova rota de leitura: `/logistica/google-maps/custos-quotas`.
- `/logistica/google-maps/resumo` passa a incluir `cost_and_quotas`.

### Banco/migracoes

- Sem alteracao de schema.
- Migracao necessaria: nao.

## 5) Compatibilidade e rollout históricos — abril/maio de 2026

- Backward compatibility: mantida; comportamento padrao fica conservador (`False` no gate).
- Backward compatibility: mantida; lookup ao vivo na leitura permanece habilitado por padrao para evitar regressao de precisao.
- Feature flags/settings: `LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY`, `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ`, `LOGISTICA_GOOGLE_TRAFFIC_AWARE`.
- Rollback: reverter commit da feature.

## 6) Criterios de aceitacao (CA)

- CA-001: cache por requisicao evita lookup repetido do mesmo par/perfil/fallback nos loops da agenda.
- CA-002: com gate desligado, heuristica pode continuar considerada atual mesmo com API key.
- CA-003: com gate ligado, heuristica volta a ser considerada stale quando houver referencia valida e API key.
- CA-004: testes de logistica/agenda passam localmente.
- CA-005: guardrail SDD aprova o diff.
- CA-006: custo e quotas ficam disponiveis em `cost_and_quotas` no resumo e no endpoint dedicado.
- CA-007: default de leitura preserva lookup ao vivo para nao degradar precisao sem rollout explicito.
- CA-008: recomendacao de `qpm_soft` nao fica artificialmente inflada em baixo volume.

Critérios adicionais para `cache_only`: cache permitido funciona sem rede; miss/stale/heurística bloqueiam; providers, jobs e acesso direto não contornam o modo; falha do controle compartilhado fecha o envio; troca concorrente de modo não aumenta o teto da ação; bloqueio fica visível e não altera parcialmente a agenda. Registrar a nova prova em `../google-maps-enforced-budget/verify.md`, sem reutilizar resultados históricos como prova de produção.
