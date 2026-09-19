# Spec - portal-clinica-link-laudo-whatsapp

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Escopo funcional

O aviso de laudo liberado que ja vai pelo WhatsApp da clinica passa a carregar um
link que abre **aquele laudo especifico** numa pagina publica enxuta
(`/laudo/<token>`), sem conta, sem senha e sem cadastro. A pagina mostra pet, exame
e data, e oferece o download dos arquivos daquele exame - nada mais. O PDF nunca
trafega pelo WhatsApp.

O link e um token opaco de 256 bits guardado como hash, vinculado a um unico
`exame_id` + `clinica_id`, sem expiracao, revogavel, e invalido assim que o laudo
deixa de estar liberado no portal. Cada abertura e auditada.

O login por e-mail e senha continua existindo sem alteracao, como via para
historico, financeiro, agenda e recibos.

## 2) Requisitos funcionais (RF)

- RF-001: nova tabela `portal_clinic_exam_links` guarda o link emitido: hash do
  token, `exame_id`, `laudo_id`, `clinica_id`, status, dados de entrega, contadores
  de acesso e revogacao.
- RF-002: `POST /laudos/{laudo_id}/portal/whatsapp` passa a emitir (ou reaproveitar)
  um link para o par (exame, clinica) e a enviar o modelo novo `portalReportLink`,
  com 4 parametros: clinica, exame, pet e **URL do link**.
- RF-003: o envio so usa o modelo novo quando `PORTAL_CLINIC_EXAM_LINK_ENABLED`
  estiver ligada. Desligada, o comportamento e byte a byte o de hoje
  (`portalReportAvailable`, 3 parametros, sem link).
- RF-004: se o envio do modelo novo falhar (modelo ainda nao aprovado pela Meta,
  servico fora), o fluxo **degrada para `portalReportAvailable`** e a mensagem sai
  sem link, em vez de falhar. A resposta do endpoint informa qual modelo foi usado.
- RF-005: `POST /portal/laudo-link/{token}` (publico, sem autenticacao) resolve o
  link e devolve os dados minimos daquele exame - nome da clinica, pet, tipo de
  exame, data do exame - mais um item de download por anexo, cada um com
  `download_token` de vida curta reaproveitando `create_portal_download_token`.
- RF-006: o endpoint de resolucao recusa (404 generico, sem distinguir os casos para
  quem chama) token inexistente, link revogado, exame fora do ar
  (`is_portal_released_status` falso) ou clinica inativa.
- RF-007: cada resolucao bem-sucedida incrementa `open_count`, grava
  `first_opened_at` (na primeira vez) e `last_opened_at`, e registra auditoria
  `PORTAL_EXAM_LINK_OPENED`.
- RF-008: `POST /laudos/{laudo_id}/portal/link/revogar` (interno, autenticado)
  revoga **todos** os links ativos daquele exame e registra auditoria.
- RF-009: revogar a liberacao do exame no portal
  (`revogar_liberacao_exame_no_portal`, `atendimento.py:5296`) revoga junto os links
  ativos daquele exame.
- RF-010: nova pagina `/laudo/[token]` no frontend, mobile-first, com no maximo uma
  acao principal: abrir/baixar o laudo. Sem menu, sem login, sem navegacao para o
  resto do portal.
- RF-011: o catalogo do servico Node ganha a chave `portalReportLink`, fora do
  catalogo exposto a caixa de entrada do Atendimento (igual aos modelos de convite),
  porque e disparada so pelo fluxo automatizado.
- RF-012: reenviar o aviso para o mesmo exame **reaproveita** o link ativo existente
  em vez de emitir outro, para nao multiplicar credenciais vivas para o mesmo
  recurso. So emite novo se nao houver nenhum ativo.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/escopo): o link nunca da acesso a lista de exames, financeiro,
  agenda ou historico da clinica. O endpoint de resolucao nao emite sessao de portal
  (`create_portal_session_token`) - devolve so o conteudo daquele exame e tokens de
  download presos a `(exame_id, anexo_id)` com validade de
  `PORTAL_DOWNLOAD_TOKEN_EXPIRE_MINUTES`. Um link vazado expoe um laudo, nunca o
  acervo da unidade.
- NFR-002 (seguranca/token): o token e `HMAC-SHA256(SECRET_KEY, exame_id + nonce)`
  em base64url (256 bits), persistido apenas como SHA-256 - igual ao padrao ja usado
  em convites, reset de senha e desafios. Forca bruta e inviavel e um dump de banco
  sozinho nao entrega link utilizavel (falta a SECRET_KEY). A derivacao, em vez de
  sorteio puro, existe para que **reenviar o aviso repita a mesma URL** (RF-012);
  o `token_nonce` e sorteado a cada emissao, de modo que reemitir depois de uma
  revogacao produz link diferente - revogacao nunca volta atras (CB-003).
- NFR-003 (falha fechada): qualquer duvida na resolucao resulta em 404 generico. A
  pagina publica nunca revela se um token existiu, se foi revogado ou se o exame
  saiu do ar.
- NFR-004 (observabilidade): emissao, entrega, abertura e revogacao geram evento de
  auditoria com `exame_id`, `clinica_id` e sufixo do numero de destino - nunca o
  token nem o numero completo.
- NFR-005 (compatibilidade): com a flag desligada, nenhum comportamento atual muda.
  Nenhum modelo aprovado pela Meta e alterado.
- NFR-006 (privacidade/LGPD): a pagina publica expoe o minimo para a secretaria
  identificar o laudo certo (pet, exame, data, nome da clinica). Nao expoe dados do
  tutor, CPF, telefone nem historico clinico.

## 4) Contratos tecnicos

### API

#### `POST /api/v1/portal/laudo-link/{token}` (publico)

- Metodo: POST (evita prefetch de link e o guard de token em query string).
- Payload: vazio.
- Resposta 200:

```json
{
  "clinica_nome": "Clinica Pet Sus",
  "paciente_nome": "Thor",
  "tipo_exame": "Ecocardiograma",
  "data_exame": "2026-09-17",
  "arquivos": [
    {
      "anexo_id": 12,
      "nome_original": "laudo-thor.pdf",
      "mime_type": "application/pdf",
      "download_url": "/api/v1/portal/anexos/12/arquivo",
      "download_token": "<jwt curto>",
      "download_token_header": "x-portal-download-token",
      "expires_at": "2026-09-18T14:37:00"
    }
  ]
}
```

- Resposta 404: `{"detail": "Link de laudo invalido ou indisponivel."}` para token
  inexistente, revogado, exame despublicado ou clinica inativa.

#### `POST /api/v1/laudos/{laudo_id}/portal/link/revogar` (interno, autenticado)

- Payload: `{"motivo": "<texto opcional>"}`.
- Resposta 200: `{"revogados": 2, "exame_id": 88}`.

#### `POST /api/v1/laudos/{laudo_id}/portal/whatsapp` (alterado)

- Payload: inalterado (`destination`, `idempotency_key` opcionais).
- Resposta ganha os campos `template_key` (`"portalReportLink"` ou
  `"portalReportAvailable"`) e `link_incluido` (bool).

### Banco/migracoes

- Tabela nova: `portal_clinic_exam_links`.
  - `id`, `token_hash` (VARCHAR(64), unico), `token_nonce` (VARCHAR(32)),
    `exame_id`, `laudo_id`, `clinica_id`, `status` (`active` | `revoked`),
    `created_by_user_id`, `delivery_channel`, `delivery_target_masked`,
    `delivered_at`, `first_opened_at`, `last_opened_at`, `open_count`,
    `revoked_at`, `revoked_reason`, `created_at`.
- Indices: unico em `token_hash`; indices em `exame_id`, `clinica_id`, `status`.
- Migracao necessaria: sim - `backend/migrations/versions/20260918_87_portal_clinic_exam_links.py`.

### Frontend

- Tela nova: `frontend/app/laudo/[token]/page.tsx` (server shell) +
  `frontend/components/portal/PortalExamLinkWorkspace.tsx` (client).
- Estados de UI: carregando; laudo disponivel (pet, exame, data, botao de download
  por arquivo); erro generico ("Este link nao esta mais disponivel"), com orientacao
  para falar com a Fort Cordis.
- Regras de exibicao: sem link para o resto do portal alem de um rodape discreto
  ("Acessar o portal completo"); layout legivel em tela de celular; nenhuma
  exigencia de login.

### Configuracao

- `PORTAL_CLINIC_EXAM_LINK_ENABLED: bool = False` (nova).
- `PORTAL_CLINIC_EXAM_LINK_BASE_URL: str = ""` (opcional; vazio usa
  `request.base_url`).

## 5) Compatibilidade e rollout

- Backward compatibility: com `PORTAL_CLINIC_EXAM_LINK_ENABLED=false`, o aviso sai
  exatamente como hoje. Nenhum modelo aprovado e alterado. Nenhum endpoint existente
  muda de contrato de entrada.
- Feature flag: `PORTAL_CLINIC_EXAM_LINK_ENABLED`.
- Dependencia externa: aprovacao do modelo `laudo_disponivel_portal_link` pela Meta.
  Enquanto `metaId` for `PENDING_META_APPROVAL`, o envio degrada para o modelo atual
  (RF-004) e o link nao chega - o resto da feature (emissao, pagina, revogacao)
  continua funcional e testavel.
- Estrategia de rollback: desligar a flag. A tabela e a pagina podem continuar no ar
  sem efeito; links ja emitidos seguem validos ate revogacao explicita.

## 6) Criterios de aceitacao (CA)

- CA-001: com a flag ligada, `POST /laudos/{id}/portal/whatsapp` emite um link,
  envia `portalReportLink` com 4 parametros e o 4o parametro e uma URL terminando em
  `/laudo/<token>`.
- CA-002: com a flag desligada, o mesmo endpoint envia `portalReportAvailable` com 3
  parametros e nenhum link e emitido.
- CA-003: quando `portalReportLink` falha no envio, o fluxo degrada para
  `portalReportAvailable`, a resposta traz `link_incluido: false` e o endpoint nao
  retorna erro.
- CA-004: `POST /portal/laudo-link/{token}` com token valido devolve pet, exame e ao
  menos um item de download com `download_token` valido para aquele anexo.
- CA-005: o mesmo endpoint devolve 404 generico para token inexistente, link
  revogado e exame cujo status saiu de "Liberado no portal".
- CA-006: o `download_token` devolvido nao serve para outro anexo nem para outro
  exame (o guard ja existente em `/anexos/{id}/arquivo` recusa com 403).
- CA-007: a resposta do link **nao** contem `access_token` de sessao de portal, e o
  token devolvido nao abre `/portal/clinicas/exames`.
- CA-008: revogar a liberacao do exame no portal invalida o link na mesma hora.
- CA-009: reenviar o aviso para o mesmo exame reaproveita o link ativo (mesmo
  `token_hash` em banco, nenhuma linha nova).
- CA-010: abrir o link incrementa `open_count` e grava `first_opened_at` so na
  primeira abertura.
- CA-011: a pagina `/laudo/[token]` renderiza os dados do exame e dispara o download
  sem pedir login, e mostra mensagem generica quando o link nao vale mais.
- CA-012: o catalogo exposto pela caixa de entrada continua com exatamente 12
  modelos (`portalReportLink` fica de fora).

## 7) Casos de borda

- CB-001: exame sem anexo com fonte de download - a pagina abre e explica que o
  arquivo ainda nao esta disponivel, em vez de erro cru.
- CB-002: clinica desativada depois da emissao - link para de funcionar (404).
- CB-003: laudo revogado e depois liberado de novo - o link antigo continua
  revogado; o novo aviso emite link novo.
- CB-004: dois avisos para o mesmo exame em numeros diferentes da mesma clinica -
  reaproveita o mesmo link (RF-012).
- CB-005: token com formato invalido (curto, com caracteres estranhos) - 404
  generico, sem consulta ao banco quando o formato ja e impossivel.
- CB-006: `WHATSAPP_AGENDA_ENABLED=false` - o endpoint continua recusando com 503
  antes de emitir link, como hoje.

## 8) Fora de escopo

- Confianca de dispositivo na recepcao ("manter esta unidade conectada").
- Reenvio de link sob demanda pelo bot de WhatsApp.
- Recuperacao de senha por WhatsApp.
- Envio do mesmo link por e-mail.
- Aprovacao efetiva do modelo na Meta (passo operacional, fora do codigo).
- Painel interno de links emitidos.
