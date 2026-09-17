# Spec - portal-veterinario-multiplas-clinicas

Data: 2026-09-16  
Responsavel: Martiniano  
Status: in-progress

## 1) Escopo funcional

Um veterinario parceiro passa a ter N clinicas vinculadas. Cada vinculo e uma
linha propria com um interruptor `receber_todos_laudos`.

O vinculo governa duas coisas, e so essas duas:

1. **Difusao (interruptor ligado)** — ao liberar no portal um laudo cuja clinica
   e a do vinculo, esse veterinario entra como destinatario junto com o
   veterinario nomeado no laudo: ganha `PortalPartnerReleaseTarget`, email de
   laudo liberado e, no aviso por WhatsApp, uma mensagem no numero dele.
2. **Ordenacao do seletor (sempre)** — a lista de veterinarios parceiros do
   fluxo de laudo aceita `clinica_id` e traz os vinculados aquela clinica
   primeiro.

O laudo continua com **um** `veterinario_parceiro_id` (quem encaminhou). Quem
recebe pode ser mais de um.

## 2) Requisitos funcionais (RF)

- RF-001: parceiro do tipo `veterinario` deve aceitar de 0 a N clinicas
  vinculadas, cada uma com `receber_todos_laudos` (default `false`).
- RF-002: a mesma clinica nao pode aparecer duas vezes no mesmo veterinario;
  a tentativa responde 422.
- RF-003: so clinica ativa pode ser vinculada; clinica inexistente ou inativa
  responde 404.
- RF-004: vincular clinica a parceiro do tipo `clinica` responde 422 — para esse
  tipo o vinculo continua sendo o `clinica_id` de hoje.
- RF-005: `PATCH /portal/parceiros/{id}` com `clinicas_vinculadas` **substitui**
  o conjunto inteiro (remove o que nao veio, cria o que veio, atualiza o
  interruptor do que permaneceu); sem o campo, os vinculos ficam intactos.
- RF-006: `GET /portal/parceiros` e `POST`/`PATCH` devolvem `clinicas_vinculadas`
  com `clinica_id`, `clinica_nome` e `receber_todos_laudos`.
- RF-007: ao liberar um laudo no portal, alem do veterinario nomeado no laudo,
  devem ser liberados os veterinarios **ativos** com vinculo
  `receber_todos_laudos = true` na clinica do laudo.
- RF-008: cada veterinario liberado por difusao recebe o email de laudo liberado,
  com o mesmo conteudo que o nomeado recebe.
- RF-009: o veterinario nomeado no laudo que **tambem** tem vinculo com difusao
  na mesma clinica entra uma unica vez, pelo caminho do nomeado.
- RF-010: laudo sem `clinic_id` nao difunde para ninguem — sem clinica nao ha
  vinculo a consultar.
- RF-011: o aviso por WhatsApp (`POST /laudos/{id}/portal/whatsapp`) envia uma
  mensagem para cada veterinario liberado no portal que tenha numero cadastrado,
  cada uma com o proprio nome em `{{1}}`.
- RF-012: cada envio a veterinario usa `idempotency_key` propria. O veterinario
  nomeado mantem a chave `<base>-vet` ja em producao; os de difusao usam
  `<base>-vet<partner_id>`.
- RF-013: a resposta do aviso mantem a chave `veterinario_parceiro` com o resumo
  do veterinario **nomeado** (contrato de #151) e ganha
  `veterinarios_parceiros`: lista com `partner_id`, `nome` e o mesmo resumo, para
  todos os destinos veterinarios avaliados.
- RF-014: `laudos.whatsapp_parceiro_status` vira resumo da ultima tentativa —
  `falhou` se qualquer veterinario falhou, `enviado` se houve ao menos um envio e
  nenhuma falha; `_erro` guarda o primeiro erro.
- RF-015: `GET /portal/parceiros/veterinarios/opcoes` aceita `clinica_id` e
  ordena os vinculados aquela clinica primeiro, sem esconder os demais.
- RF-016: a tela de parceiros externos deve permitir marcar varias clinicas e o
  interruptor de cada uma, no cadastro e na edicao, e mostrar os vinculos na
  listagem.
- RF-017: desativar o veterinario (`ativo = false`) preserva os vinculos, mas ele
  deixa de entrar na difusao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): laudo sem nenhum vinculo com difusao ligada percorre
  exatamente o caminho de hoje — mesmos alvos, mesmas chaves de idempotencia,
  mesma resposta. Os testes de `laudo-aviso-whatsapp-parceiro` e
  `test_laudo_portal_whatsapp_status.py` passam sem alteracao.
- NFR-002 (seguranca): a visibilidade no portal continua vindo de
  `PortalPartnerReleaseTarget` explicito. A difusao **cria** o target; nao cria
  atalho de leitura sem target, e nao herda por email, cidade ou area.
- NFR-003 (performance): a difusao adiciona uma consulta por liberacao de laudo,
  indexada por `clinica_id`; a listagem de parceiros carrega os vinculos em uma
  consulta unica, sem N+1.
- NFR-004 (observabilidade): cada destinatario por difusao gera auditoria propria
  com `partner_id` e a origem `vinculo_clinica`, distinguivel do nomeado.
- NFR-005 (migracao): a migracao e idempotente e nao toca dado existente — cria
  tabela vazia. Nenhum veterinario passa a receber nada ate que um admin crie um
  vinculo e ligue o interruptor.

## 4) Contratos tecnicos

### Banco

Tabela nova `portal_partner_clinic_links`:

| coluna | tipo | nota |
| --- | --- | --- |
| `id` | PK | |
| `partner_id` | int, index, NOT NULL | `portal_partner_profiles.id`, tipo `veterinario` |
| `clinica_id` | int, index, NOT NULL | `clinicas.id` |
| `receber_todos_laudos` | bool, NOT NULL, default `false` | o interruptor |
| `created_at` / `updated_at` | timestamp | |

`UniqueConstraint(partner_id, clinica_id)` — `uq_portal_partner_clinic_link`.

Sem FK declarada, acompanhando `portal_partner_release_targets` e
`portal_partner_profiles`, que tambem guardam id solto.

### API

- `POST /api/v1/portal/parceiros` e `PATCH /api/v1/portal/parceiros/{id}`
  - Payload ganha `clinicas_vinculadas: [{ clinica_id: int, receber_todos_laudos?: bool }]`
  - Resposta ganha `clinicas_vinculadas: [{ clinica_id, clinica_nome, receber_todos_laudos }]`
  - 422 para clinica repetida, para `clinicas_vinculadas` em parceiro do tipo
    `clinica`; 404 para clinica inativa/inexistente

- `POST /api/v1/portal/parceiros/veterinarios/cadastro-rapido`
  - Mesmo campo, mesmo comportamento

- `GET /api/v1/portal/parceiros/veterinarios/opcoes`
  - Query ganha `clinica_id: int | None`
  - Ordem: vinculados a `clinica_id` primeiro (e entre eles, os de difusao
    ligada antes), depois o restante por nome

- `POST /api/v1/laudos/{laudo_id}/portal/liberar`
  - Resposta: `destinos_liberados_agora` ganha
    `veterinarios_por_vinculo: [partner_id]`

- `POST /api/v1/laudos/{laudo_id}/portal/whatsapp`
  - Resposta ganha `veterinarios_parceiros: [{ partner_id, nome, status, ... }]`
  - `veterinario_parceiro` (singular) permanece com o resumo do nomeado

## 5) Criterios de aceitacao (CA)

- CA-001: `POST /portal/parceiros` com `tipo=veterinario` e tres clinicas (uma
  com `receber_todos_laudos=true`) cria tres linhas e devolve as tres com o nome
  da clinica.
- CA-002: a mesma `clinica_id` duas vezes no payload responde 422 e nao grava
  nada.
- CA-003: clinica inativa responde 404 e nao grava nada.
- CA-004: `clinicas_vinculadas` em `tipo=clinica` responde 422.
- CA-005: `PATCH` com dois dos tres vinculos substitui o conjunto: o ausente some,
  o interruptor alterado persiste. `PATCH` sem o campo preserva os tres.
- CA-006: liberar laudo da clinica A, sem veterinario nomeado, com um vinculo de
  difusao ativo em A, cria `PortalPartnerReleaseTarget` para esse veterinario e
  dispara `notify_partner_report_released` para ele.
- CA-007: o mesmo laudo com veterinario nomeado **e** um segundo veterinario de
  difusao cria dois targets e dois emails.
- CA-008: veterinario nomeado que tambem tem vinculo de difusao na clinica do
  laudo recebe **um** target e **um** email.
- CA-009: veterinario com vinculo de difusao mas `ativo = false` nao recebe
  target nem email.
- CA-010: vinculo com `receber_todos_laudos = false` nao recebe target nem email
  quando nao e o nomeado.
- CA-011: laudo sem `clinic_id` e com veterinario nomeado libera so o nomeado —
  nenhuma consulta de difusao muda o resultado.
- CA-012: o aviso por WhatsApp de um laudo com nomeado + um de difusao chama
  `send_approved_utility_template` tres vezes (clinica + dois veterinarios), cada
  uma com o proprio nome em `{{1}}`, e as chaves `<base>`, `<base>-vet` e
  `<base>-vet<id>`.
- CA-013: veterinario de difusao sem numero cadastrado aparece na resposta como
  `ignorado`/`sem_whatsapp` e nao impede os demais envios.
- CA-014: falha no envio a um veterinario de difusao mantem 200, grava
  `whatsapp_parceiro_status = "falhou"` com o erro em `_erro`, e nao impede o
  envio ao outro veterinario.
- CA-015: com nomeado e difusao enviados com sucesso,
  `whatsapp_parceiro_status = "enviado"` e `veterinarios_parceiros` traz os dois
  com `status = "enviado"`.
- CA-016: `GET /portal/parceiros/veterinarios/opcoes?clinica_id=A` traz os
  vinculados a A antes dos demais, sem remover ninguem da lista.
- CA-017: a migracao roda duas vezes na mesma conexao sem erro e deixa a tabela
  com o indice unico.
- CA-018: na tela de parceiros, o cadastro de veterinario permite marcar varias
  clinicas com o interruptor de cada uma; a edicao carrega o que esta salvo; a
  listagem mostra as clinicas vinculadas e quais difundem.
- CA-019: os testes ja existentes de `laudo-aviso-whatsapp-parceiro` e de
  `test_laudo_portal_whatsapp_status.py` continuam passando sem alteracao
  (NFR-001).

## 6) Fora de escopo

- Vinculo para parceiro do tipo `clinica`.
- Escolher, no momento do envio, um numero diferente do cadastrado.
- Difusao para o tutor.
- Status de WhatsApp por veterinario em coluna propria — o detalhe fica na
  resposta e na auditoria; a coluna e resumo.
