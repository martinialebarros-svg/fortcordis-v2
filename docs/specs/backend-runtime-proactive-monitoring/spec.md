# Spec - backend-runtime-proactive-monitoring

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Implementar monitoramento proativo de runtime para:
- contagem recente de erros HTTP `5xx` em janela configuravel;
- estado do worker de auto-cleanup dedupe;
- consolidacao desses sinais no `runtime_report` consumido por `/health` e `/ready`.

## 2) Requisitos funcionais (RF)

- RF-001: registrar respostas HTTP `5xx` em monitor in-memory via middleware global.
- RF-002: expor resumo do monitor de `5xx` no `runtime_report`.
- RF-003: incluir estado do worker de upload dedupe cleanup no `runtime_report`.
- RF-004: adicionar warnings operacionais no `runtime_report` quando alertas estiverem ativos.
- RF-005: manter formato atual de `health`/`ready` e adicionar apenas campos novos.
- RF-006: configurar janela e threshold do alerta `5xx` por variaveis de ambiente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): overhead minimo por requisicao no middleware.
- NFR-002 (estabilidade): falha no monitor nao deve derrubar API.
- NFR-003 (compatibilidade): sem breaking change em campos existentes de health.
- NFR-004 (operacao): readiness nao deve oscilar por picos curtos de 5xx.

## 4) Contratos tecnicos

### Backend

- Novo servico: monitor de erros HTTP 5xx (estado em memoria do processo).
- Novo trecho de middleware em `main.py` para registrar status code.
- Extensao de `build_runtime_report()` com secao `observability`.
- Extensao de payload de `health/ready` com `checks.observability`.

### Configuracao

- `RUNTIME_HTTP_5XX_ALERT_WINDOW_MINUTES` (padrao: `5`, minimo: `1`, maximo: `60`).
- `RUNTIME_HTTP_5XX_ALERT_THRESHOLD` (padrao: `20`, minimo: `1`, maximo: `500`).

## 5) Compatibilidade e rollout

- Rollout: deploy normal em `stage` e depois `main`.
- Rollback: revert do commit do monitoramento.
- Compatibilidade: consumidores antigos continuam funcionando com os campos existentes.

## 6) Criterios de aceitacao (CA)

- CA-001: middleware registra eventos `5xx` sem impacto funcional nas rotas.
- CA-002: `runtime_report` inclui bloco de observabilidade com status de 5xx e worker cleanup.
- CA-003: `/health` e `/ready` retornam os novos sinais consolidados.
- CA-004: alerta de `5xx` alto entra como warning e nao derruba readiness por si so.
- CA-005: existem testes cobrindo threshold/janela do monitor de 5xx.

## 7) Casos de borda

- CB-001: janela configurada com valor invalido.
- CB-002: grande volume de requests 2xx/4xx (nao deve inflar alerta).
- CB-003: excecao nao tratada (deve ser contabilizada como 5xx).

## 8) Fora de escopo

- Persistencia historica de erros em banco.
- Exportacao para Prometheus/Grafana.
