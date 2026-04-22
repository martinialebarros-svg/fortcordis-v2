# Spec - logistica-agenda-google-cost-control

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

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (custo): reduzir chamadas redundantes ao Google Maps.
- NFR-002 (compatibilidade): manter contratos de API existentes.
- NFR-003 (operacao): ajuste de refresh agressivo deve ser controlado por setting.

## 4) Contratos tecnicos

### Backend/configuracao

- Novo setting: `LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY` (default `False`).

### API

- Sem mudanca de payload em agenda.
- Rota de leitura `/logistica/cobertura-matriz` mantida.

### Banco/migracoes

- Sem alteracao de schema.
- Migracao necessaria: nao.

## 5) Compatibilidade e rollout

- Backward compatibility: mantida; comportamento padrao fica conservador (`False` no gate).
- Feature flag/setting: `LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY`.
- Rollback: reverter commit da feature.

## 6) Criterios de aceitacao (CA)

- CA-001: cache por requisicao evita lookup repetido do mesmo par/perfil/fallback nos loops da agenda.
- CA-002: com gate desligado, heuristica pode continuar considerada atual mesmo com API key.
- CA-003: com gate ligado, heuristica volta a ser considerada stale quando houver referencia valida e API key.
- CA-004: testes de logistica/agenda passam localmente.
- CA-005: guardrail SDD aprova o diff.
