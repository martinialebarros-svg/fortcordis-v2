# Spec - whatsapp-fila-nao-lida-urgencia

## Requisitos funcionais

- RF-001: `conversations` ganha coluna `last_seen_at TIMESTAMPTZ`, nula por
  padrão.
- RF-002: `PATCH /conversations/:id/seen` marca `last_seen_at = now()` para a
  conversa informada; `404` se não existir.
- RF-003: `GET /conversations` retorna um campo booleano `unread` por
  conversa, calculado como
  `last_inbound_at IS NOT NULL AND (last_seen_at IS NULL OR last_inbound_at > last_seen_at)`.
- RF-004: a ordenação de `GET /conversations` passa a ser: não lidas
  primeiro; dentro do grupo de não lidas, quem tem `last_inbound_at` mais
  antigo aparece primeiro (prioriza espera mais longa); conversas **não**
  não-lidas (lidas, ou sem nenhuma mensagem recebida ainda — ex.: reserva
  automática enviada a uma clínica nova) são ordenadas só por
  `last_activity_at` mais recente primeiro, sem nenhum peso de
  `last_inbound_at` — ver CA-005 para o bug corrigido aqui.
- RF-005: `GET /conversations/:id/messages` passa a incluir `last_inbound_at`
  no corpo da resposta (já calculado internamente, só precisa ser exposto).
- RF-006: ao abrir uma conversa (carga não-silenciosa), o frontend chama
  `PATCH .../seen`.
- RF-007: durante o polling silencioso de 5s de uma conversa já aberta, o
  frontend chama `PATCH .../seen` novamente somente se o `last_inbound_at`
  retornado mudou desde a última vez visto (indicando mensagem nova),
  nunca a cada ciclo de poll sem mudança.
- RF-008: a lista de conversas exibe um indicador visual quando
  `conversation.unread` é `true`, e deixa de exibi-lo assim que a marcação
  local de "vista" é aplicada (sem esperar o próximo `GET /conversations`).

## Requisitos não funcionais

- NFR-001 (compatibilidade): endpoints e campos existentes (`GET
  /conversations`, `GET .../messages`, `PATCH .../status`) continuam
  funcionando sem mudança de contrato além das adições acima.
- NFR-002 (migração): `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no
  `init.sql` único e idempotente, sem exigir arquivo de migração novo.

## Contratos de API

### `PATCH /conversations/:id/seen`

Sem corpo. Resposta `200`: `{ "data": { "id": "...", "last_seen_at": "..." } }`.
`404` se a conversa não existir.

### `GET /conversations` (campos novos)

Cada item de `data[]` ganha `unread: boolean` e `last_seen_at: string | null`.

### `GET /conversations/:id/messages` (campo novo)

Corpo ganha `last_inbound_at: string | null` no nível raiz da resposta (além
de já existir dentro de `customer_service_window`).

## Critérios de aceitação

- CA-001: conversa com mensagem recebida após o último `seen` aparece com
  `unread: true` e o indicador visual na lista.
- CA-002: abrir a conversa dispara `PATCH .../seen`; a partir daí ela deixa
  de aparecer como não lida (local e, na próxima listagem, também no
  backend).
- CA-003: poll silencioso sem novo `last_inbound_at` não dispara `PATCH
  .../seen` de novo.
- CA-004: não lidas aparecem antes das lidas na listagem; entre não lidas, a
  que espera há mais tempo (`last_inbound_at` mais antigo) vem primeiro.
- CA-005: uma conversa sem nenhuma mensagem recebida (`last_inbound_at
  IS NULL`, ex.: reserva automática recém-enviada a uma clínica) e com
  atividade agora mesmo aparece **antes** de uma conversa lida há muito
  tempo, mesmo que a última tenha `last_inbound_at` preenchido (não deve
  cair para o fim da lista só por nunca ter recebido mensagem).
