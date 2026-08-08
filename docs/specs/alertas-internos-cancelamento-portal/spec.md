# Spec - alertas-internos-cancelamento-portal

Data: 2026-08-08
Status: draft (implementado; aguardando QA)

## 1) Escopo funcional

Sino de alertas fixo, visivel em qualquer pagina interna, com contagem de nao lidos, lista em
dropdown e acao de marcar como lido (individual ou em lote). Primeiro (e unico, nesta entrega)
produtor de alertas: cancelamento de agendamento pelo portal da clinica.

## 2) Requisitos funcionais (RF)

- RF-001: Cancelar um agendamento pelo portal (`cancelar_agendamento_clinica_portal`) cria um
  `AlertaInterno` (`tipo="agendamento_cancelado_portal"`, `nivel="aviso"`) na mesma transacao do
  cancelamento, com `entidade_tipo="agendamento"`, `entidade_id` e `clinica_id` preenchidos.
- RF-002: `GET /api/v1/alertas-internos` retorna `total_nao_lidos` (contagem real, independente do
  `limit`) e `items` (por padrao, so os nao lidos; `incluir_lidos=true` inclui todos).
- RF-003: `PATCH /api/v1/alertas-internos/{id}/marcar-lido` marca um alerta especifico como lido,
  registrando quem e quando; idempotente (marcar de novo um alerta ja lido nao sobrescreve
  `lido_por`/`lido_em`).
- RF-004: `POST /api/v1/alertas-internos/marcar-todos-lidos` marca todos os alertas nao lidos como
  lidos de uma vez.
- RF-005: O sino (`AlertasInternosBell`) busca alertas ao montar e a cada 45s; mostra contador de
  nao lidos sobre o icone; abre um dropdown com a lista ao clicar; fecha ao clicar fora.
- RF-006: O sino aparece em qualquer pagina que usa `DashboardLayout` (equipe interna); nao aparece
  no portal externo (`clinica-parceira`), que nao usa esse layout.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (confiabilidade): a criacao do alerta acontece na mesma transacao do cancelamento — se o
  `db.commit()` falhar, nem o cancelamento nem o alerta sao persistidos (sem "cancelamento
  silencioso sem aviso").
- NFR-002 (visibilidade ampla): qualquer usuario interno autenticado ve todos os alertas (sem
  filtro por papel) — decisao deliberada para maximizar a chance de alguem ver.
- NFR-003 (resiliencia do frontend): falha ao buscar/marcar alertas nunca lanca erro visivel ao
  usuario nem interrompe a navegacao — falha silenciosa, tenta de novo no proximo poll/clique.

## 4) Contratos tecnicos

### API

- `GET /api/v1/alertas-internos?incluir_lidos=false&limit=50`
  - Auth: `current_user` (qualquer usuario interno autenticado).
  - Resposta: `AlertaInternoListResponse` (`total_nao_lidos`, `items`).
- `PATCH /api/v1/alertas-internos/{alerta_id}/marcar-lido` → `AlertaInternoResponse`.
- `POST /api/v1/alertas-internos/marcar-todos-lidos` → `AlertaInternoAckResponse`.

### Banco/migracoes

- Nova tabela `alertas_internos` (migracao `20260808_65_alertas_internos.py`): `id`, `tipo`,
  `nivel`, `titulo`, `mensagem`, `entidade_tipo`, `entidade_id`, `clinica_id`, `lido`,
  `lido_por_id`, `lido_por_nome`, `lido_em`, `criado_em`. Indice em `(lido, criado_em, id)` para a
  consulta de nao lidos mais recentes.

### Frontend

- Novo componente `frontend/components/layout/AlertasInternosBell.tsx`, montado (via
  `next/dynamic`, `ssr:false`) em `frontend/app/layout-dashboard.tsx`, junto aos demais utilitarios
  de layout (`PushNotificationsBootstrap`, etc).
- Usa o cliente `api` (`@/lib/axios`) padrao — mesma autenticacao/cookies das demais telas
  internas.

## 5) Compatibilidade e rollout

- Backward compatible; tabela e endpoints novos; nenhuma tela existente muda de comportamento.
- Pendente de QA manual do usuario em stage (sino e client-only, nao verificavel visualmente sem
  backend/sessao real neste ambiente).
- Rollback: reverter os commits; a migracao so cria uma tabela nova (sem dado pre-existente para
  perder).

## 6) Criterios de aceitacao (CA)

- CA-001: Cancelar um agendamento pelo portal cria exatamente um alerta, com os dados corretos
  (clinica, agendamento, tipo).
- CA-002: Tentar cancelar um agendamento que nao pode ser cancelado (outra clinica, status
  invalido) NAO cria nenhum alerta.
- CA-003: `GET /alertas-internos` sem parametros retorna so os nao lidos; com
  `incluir_lidos=true`, retorna todos.
- CA-004: Marcar um alerta como lido faz ele sair da lista padrao (nao lidos) e aparecer quando
  `incluir_lidos=true`.
- CA-005: Marcar todos como lidos zera `total_nao_lidos`.
- CA-006: Tentar marcar como lido um alerta inexistente retorna 404.

## 7) Casos de borda

- CB-001: Dois cancelamentos concorrentes de agendamentos diferentes — cada um gera seu proprio
  alerta (sem lock especial alem do lock de escrita da agenda ja existente no cancelamento).
- CB-002: Poll do sino falha (rede/backend fora) — o sino nao mostra erro, so mantem o ultimo
  estado conhecido e tenta de novo no proximo ciclo.

## 8) Fora de escopo

- Expiracao/arquivamento automatico de alertas antigos.
- Filtragem por tipo/nivel na UI do sino.
- Outros produtores de alerta alem do cancelamento pelo portal (a infraestrutura e generica e pode
  ganhar novos tipos de alerta depois).
- SSE/push em tempo real para o sino (polling de 45s e o mecanismo desta entrega).
