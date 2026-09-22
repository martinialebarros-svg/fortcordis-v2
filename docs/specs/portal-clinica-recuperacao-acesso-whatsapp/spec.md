# Spec - portal-clinica-recuperacao-acesso-whatsapp

Data: 2026-09-20
Responsavel: Martiniano Barros
Status: draft

## 1) Escopo funcional

A unidade pede, pela tela publica do portal, um acesso **aos laudos** entregue no
WhatsApp que ela ja tem cadastrado conosco. O link recebido abre o portal em **modo
laudos** - o mesmo escopo `exam:read` / `exam:download` do dispositivo confiavel - e
oferece manter aquele computador conectado.

Recuperacao de **senha** continua sendo por e-mail, e recuperacao do **portal
completo** continua passando pela Fort Cordis (`/admin/clinicas/{id}/convites`).
Decisao do usuario em 2026-09-20, pelos motivos da secao 4 do intent: redefinir senha
por WhatsApp nao desbloquearia ninguem sem o e-mail (o MFA seguinte sai por e-mail) e
entregaria financeiro a quem atende o WhatsApp da recepcao.

## 2) Requisitos funcionais (RF)

### Pedido

- RF-001: a tela publica do portal da clinica ganha, ao lado de "Esqueci minha
  senha", a acao **"Nao tem a senha? Receba o acesso aos laudos no WhatsApp da
  unidade"**.
- RF-002: o pedido leva **so o numero de WhatsApp**. Nao pede e-mail, nome da clinica
  nem senha - se pedisse, a secretaria esbarraria no mesmo dado que ela nao tem.
- RF-003: o numero informado e normalizado por `normalize_whatsapp_number` e
  comparado com os numeros cadastrados da clinica (`whatsapps` + `telefone`), a mesma
  resolucao que `_registered_clinic_whatsapp_numbers` usa no aviso de laudo.
- RF-004: a resposta e **sempre a mesma**, com ou sem clinica correspondente, com ou
  sem falha de envio - no modelo de `_generic_reset_response()`. A tela diz que, se o
  numero estiver cadastrado, a mensagem chega em instantes.
- RF-005: a mensagem so sai para o numero **como esta cadastrado**, nunca para o
  numero digitado. Na pratica sao o mesmo por construcao; o requisito existe para que
  a implementacao nao aceite um numero de destino vindo do pedido.
- RF-006: clinica inativa nao recebe nada, e a resposta segue sendo a mesma.

### Token e entrega

- RF-007: cada pedido cria uma linha em `portal_clinic_access_recoveries` com o
  **hash** do token, prazo curto e uso unico. Diferente do link de laudo, que e
  estavel de proposito, este e descartavel: nao ha reenvio a reaproveitar.
- RF-008: prazo de validade configuravel, default **30 minutos**.
- RF-009: abrir o link marca `used_at` e o token nao vale de novo. Segunda abertura
  devolve a mesma recusa generica de um token inexistente.
- RF-010: limite de **3 pedidos por clinica em 24 horas**. Ao estourar, a resposta
  continua identica (RF-004) e nada e enviado.
- RF-011: a entrega usa modelo aprovado da Meta, com o link e o prazo. Ver a secao 4.

### Acesso concedido

- RF-012: abrir o link valido emite sessao de portal com escopo **exatamente**
  `["exam:read", "exam:download"]`, sem `clinic:read` - a mesma de
  `confiar-dispositivo`. Financeiro, agenda e recibos seguem exigindo senha.
- RF-013: a pagina do link oferece "manter esta unidade conectada neste computador",
  reaproveitando `portal_clinic_device_trust_service`. A confianca nasce com
  `origin = "whatsapp_recovery"` e `origin_exam_link_id = NULL`.
- RF-014: como em RF-023 de `portal-clinica-dispositivo-confiavel`, a tela so confirma
  a conexao depois de `dispositivo/sessao` provar que o navegador guardou o cookie.
- RF-015: conectar dispara o aviso ao gestor que ja existe
  (`notify_clinic_device_trusted`), e falha no aviso nao impede a conexao. E o
  principal detector de abuso deste fluxo: quem nao pediu fica sabendo.
- RF-016: revogacao pelo admin (`/admin/clinica-dispositivos/revogar`) alcanca essas
  confiancas do mesmo jeito - a origem muda, o resto nao.

### Auditoria

- RF-017: registrar `PORTAL_CLINIC_ACCESS_RECOVERY_REQUESTED` no pedido aceito e
  `PORTAL_CLINIC_ACCESS_RECOVERY_USED` na abertura, com `clinica_id` e destino
  mascarado. **Nunca gravar o token nem a URL**, como em NFR-004 do link de laudo.
- RF-018: pedido recusado por limite gera auditoria propria
  (`PORTAL_CLINIC_ACCESS_RECOVERY_THROTTLED`), que e o sinal de abuso a observar.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (contencao): o alcance maximo deste fluxo e o **acervo de laudos daquela
  clinica**. Nao existe caminho, dentro dele, que leve a financeiro, agenda, recibos
  ou a troca de senha da conta.
- NFR-002: o token e opaco (`generate_opaque_token`), guardado por `hash_secret`, e o
  banco nunca ve o valor em claro - mesmo padrao do convite e do reset de senha.
- NFR-003: nenhuma resposta permite distinguir numero cadastrado de nao cadastrado,
  clinica ativa de inativa, ou limite estourado de pedido aceito.
- NFR-004: o fluxo nao altera nem enfraquece `esqueci-senha`, o MFA ou o convite
  administrativo.
- NFR-005: com `PORTAL_CLINIC_ACCESS_RECOVERY_ENABLED=false`, a acao some da tela e o
  endpoint devolve 404 - sem meio-termo em que a tela oferece o que o backend recusa.
- NFR-006: depende de `PORTAL_CLINIC_DEVICE_TRUST_ENABLED`. Com ela desligada, a
  recuperacao tambem nao aparece: sem a sessao de modo laudos, nao ha o que entregar.

## 4) Contratos tecnicos

### API

#### `POST /api/v1/portal/clinicas/recuperar-acesso` (publico)

```
{ "whatsapp": "(85) 99999-0000" }
```

Sempre **202** com o mesmo corpo, qualquer que seja o desfecho:

```
{ "message": "Se este numero estiver cadastrado, a mensagem chega em instantes." }
```

#### `POST /api/v1/portal/clinicas/recuperar-acesso/{token}` (publico)

Valida, marca `used_at`, emite a sessao de modo laudos e grava o cookie de
dispositivo. Devolve o mesmo formato de `PortalDeviceTrustResponse`.

Toda recusa - token inexistente, expirado, ja usado, clinica inativa, flag desligada
- devolve **404** com o mesmo `detail`, como `_resolver_link_laudo` ja faz para o link
de laudo.

### Banco/migracoes

Tabela nova `portal_clinic_access_recoveries`:

| coluna | tipo | nota |
| --- | --- | --- |
| `id` | PK | |
| `clinica_id` | FK, index | |
| `token_hash` | string(64), unique, index | so o hash |
| `status` | string | `pending` / `used` / `expired` |
| `expires_at` | datetime | default 30 min |
| `used_at` | datetime, null | |
| `delivery_target_masked` | string, null | `***1234` |
| `created_at` | datetime | base do limite de RF-010 |

Sem alteracao em `portal_clinic_trusted_devices` alem de aceitar
`origin = "whatsapp_recovery"` com `origin_exam_link_id` nulo - conferir se a coluna
ja e nullable antes de assumir.

### Frontend

- `/clinica-parceira`: acao nova na tela publica (RF-001) e formulario de um campo.
- `/acesso-laudos/[token]`: pagina publica nova, irma de `/laudo/[token]` -
  `noindex`, `no-referrer`, mesma recusa generica, e a acao de manter conectado.

### Modelo da Meta

Nenhum dos tres modelos aprovados diz que **a unidade pediu** o acesso:

- `convite_portal_clinica_v2` - "A Fort Cordis liberou o acesso da unidade..."
- `acesso_portal_clinica` - "A Fort Cordis atualizou o cadastro da unidade..."
- `senha_temporaria_portal_clinica` - "Concluimos o cadastro da unidade..."

Para uma mensagem que concede acesso a pedido de quem quer que tenha digitado um
numero, isso importa: sem o "se nao foi voce, ignore" que o e-mail de reset ja traz, a
clinica nao tem como notar um pedido que nao partiu dela. **Recomendacao: submeter
modelo proprio** com o pedido explicito e a validade, aceitando o ~1 dia de analise -
o problema urgente ja esta resolvido em producao, entao nao ha pressa que justifique
reaproveitar texto que descreve outra coisa.

Caminho rapido, se a decisao for outra: `convite_portal_clinica_v2` e o menos
impreciso dos tres e ja tem `{{3}}` de validade.

## 5) Compatibilidade e rollout

- `PORTAL_CLINIC_ACCESS_RECOVERY_ENABLED`, default **false**.
- `PORTAL_CLINIC_ACCESS_RECOVERY_EXPIRE_MINUTES`, default **30**.
- `PORTAL_CLINIC_ACCESS_RECOVERY_DAILY_LIMIT`, default **3**.
- Nada muda para quem ja usa o portal enquanto a flag estiver desligada.
- Ligar so depois de o modelo estar aprovado: sem ele, o pedido e aceito e a mensagem
  nao chega - e, por NFR-003, a tela nao pode dizer isso a quem pediu.

## 6) Criterios de aceitacao (CA)

- CA-001: numero cadastrado de clinica ativa recebe a mensagem com link; a resposta e
  a generica.
- CA-002: numero desconhecido, clinica inativa e limite estourado produzem **a mesma**
  resposta e **nenhum** envio.
- CA-003: o link abre o portal em modo laudos com escopo exatamente
  `["exam:read", "exam:download"]`.
- CA-004: com esse acesso, `/clinicas/financeiro` e `/clinicas/agendamentos` devolvem
  403, e `/clinicas/exames` devolve 200.
- CA-005: o mesmo link aberto duas vezes falha na segunda, com o 404 generico.
- CA-006: link expirado devolve o mesmo 404.
- CA-007: conectar o computador cria confianca com `origin = "whatsapp_recovery"`, e
  o admin a revoga como qualquer outra.
- CA-008: conectar dispara o aviso ao gestor; falha no aviso nao impede a conexao.
- CA-009: auditoria registra pedido, uso e recusa por limite, sem token e sem URL.
- CA-010: com a flag desligada, a acao nao aparece e os dois endpoints devolvem 404.
- CA-011: quarto pedido em 24h nao envia nada e gera
  `PORTAL_CLINIC_ACCESS_RECOVERY_THROTTLED`.

## 7) Casos de borda

- CB-001: duas clinicas com o mesmo numero cadastrado. Hoje nada impede - decidir se
  envia para a primeira, para todas, ou se recusa. **Recomendacao: nao enviar**, e
  registrar para a Fort Cordis resolver o cadastro duplicado.
- CB-002: numero cadastrado que nao e mais da clinica (trocou de dono). O fluxo
  entrega acesso a quem atende o numero - contido por escopo e por aviso ao gestor,
  nao eliminado.
- CB-003: navegador com cookies bloqueados - mesmo tratamento de RF-023, a tela nao
  diz que conectou.
- CB-004: pedido durante uma janela em que a WhatsApp Cloud API esta fora. O pedido e
  aceito, a mensagem nao sai, e a resposta e a mesma. O limite diario **nao** deve
  contar pedidos que falharam no envio.
- CB-005: clinica desativada entre o pedido e a abertura do link - a abertura recusa.

## 8) Fora de escopo

- Redefinir senha por WhatsApp, e qualquer coisa que devolva `clinic:read`.
- Codigo de MFA por WhatsApp.
- Numero pessoal do gestor separado do WhatsApp da unidade (fica como sugestao no
  intent).
- Recuperacao para o veterinario parceiro individual.
- Tela para a unidade listar os proprios dispositivos - segue como risco residual 5 de
  `portal-clinica-dispositivo-confiavel`.
