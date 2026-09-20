# Spec - portal-clinica-dispositivo-confiavel

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

## 1) Escopo funcional

Na pagina de um laudo aberto pelo link do WhatsApp, a clinica passa a poder marcar
**"manter esta unidade conectada neste computador"**. A partir dai aquele navegador
entra no portal em **modo laudos** - lista de exames liberados, busca no historico,
fila de "aguardando liberacao" e download - sem senha e sem conta.

O modo laudos e um escopo de verdade, nao uma escolha de tela: financeiro, agenda e
recibos passam a exigir `clinic:read`, que so uma sessao com senha carrega. Para
isso, esta entrega cria a **verificacao de escopo** que hoje nao existe (o campo e
gravado no token e nunca conferido).

A confianca renova a cada uso e cai por inatividade. E revogavel pela Fort Cordis,
pela propria recepcao ("sair deste computador") e automaticamente quando o link que
a originou e revogado.

## 2) Requisitos funcionais (RF)

### Escopo

- RF-001: nasce a constante `PORTAL_SCOPE_CLINICA_LAUDOS = ["exam:read", "exam:download"]`,
  sem `clinic:read`. `PORTAL_SCOPE_CLINICA` (com `clinic:read`) fica como esta.
- RF-002: nasce o guard `_assert_portal_scope(session, permissao)` em `portal.py`,
  que devolve 403 quando a permissao pedida nao esta em `session.scope`.
- RF-003: passam a exigir `clinic:read`: `GET /portal/clinicas/agendamentos`,
  `PATCH /portal/clinicas/agendamentos/{id}` (cancelamento),
  `GET /portal/clinicas/financeiro` e
  `GET /portal/clinicas/ordens-servico/{id}/recibo`.
- RF-004: `GET /portal/clinicas/exames` passa a exigir `exam:read` - satisfeito
  tanto pela sessao com senha quanto pelo modo laudos.
- RF-005: `POST /portal/exames/{id}/download-url` e `GET /portal/anexos/{id}/arquivo`
  exigem `exam:download` / `exam:read`, tambem satisfeitos pelos dois modos.

### Dispositivo confiavel

- RF-006: nova tabela `portal_clinic_trusted_devices`, independente de
  `portal_clinic_sessions` (que e presa a conta com senha).
- RF-007: `POST /portal/laudo-link/{token}/confiar-dispositivo` valida o link
  exatamente como a abertura do laudo valida, cria a confianca, grava o cookie de
  dispositivo e devolve uma sessao de escopo `PORTAL_SCOPE_CLINICA_LAUDOS`.
- RF-008: `POST /portal/clinicas/dispositivo/sessao` troca o cookie por um
  `access_token` novo em modo laudos, **rotacionando** o token de refresh e
  renovando o prazo de inatividade.
- RF-009: `POST /portal/clinicas/dispositivo/encerrar` revoga a confianca daquele
  navegador e limpa o cookie.
- RF-010: a confianca expira depois de
  `PORTAL_CLINIC_DEVICE_TRUST_INACTIVITY_DAYS` (default 30) **sem uso**; cada uso
  empurra o prazo para frente.
- RF-011: a confianca e amarrada ao navegador por `user_agent_hash`, no mesmo
  criterio ja usado em `refresh_login_clinica`: divergencia revoga a confianca em
  vez de apenas recusar.
- RF-012: criar a confianca dispara e-mail para os gestores da clinica
  (`resolve_clinic_release_notification_emails`), informando maquina conectada, data
  e como encerrar. Falha de envio **nao** derruba a operacao.
- RF-013: `revoke_links_for_exam` passa a revogar tambem as confiancas nascidas dos
  links revogados (via `origin_exam_link_id`) - se o link vazou, o que ele gerou
  morre junto.
- RF-014: clinica inativa invalida a confianca na hora.

### Admin

- RF-015: `GET /portal/admin/clinicas/{id}/acesso` ganha `trusted_devices` com
  rotulo, origem, ultimo acesso, prazo e status.
- RF-016: `POST /portal/admin/clinica-dispositivos/revogar` revoga uma confianca ou
  todas as de uma clinica.

### Frontend

- RF-017: `/laudo/[token]` ganha, abaixo do download, a acao "manter esta unidade
  conectada neste computador", com uma linha explicando que da acesso aos laudos da
  clinica e nao ao financeiro.
- RF-023 (acrescentado em 20/09/2026, depois do cenario 7 em stage): a acao so diz
  que conectou depois de **confirmar com o servidor** que este navegador guardou o
  cookie - uma chamada a `dispositivo/sessao` logo apos o `confiar-dispositivo`. Se a
  confirmacao devolver recusa, a tela explica que o navegador nao guardou o acesso e
  sugere sair da janela anonima; o laudo e o download continuam na tela.
  Motivo: com cookies bloqueados o `confiar-dispositivo` responde **200** e so o
  `Set-Cookie` e descartado, em silencio. A tela dizia "Pronto" para uma recepcao que
  no dia seguinte encontra o portal pedindo senha - e a suspeita cai no link.
- RF-018: `/clinica-parceira` tenta `POST /clinicas/dispositivo/sessao` no
  carregamento, antes de mostrar o formulario de login. Dando certo, entra direto.
- RF-019: sem `clinic:read`, `PortalClinicaWorkspace` esconde as abas de financeiro
  e agenda e mostra "Entrar com senha para ver financeiro e agenda".
  A acao **abre o formulario de senha sem revogar a confianca do computador**
  (implementada em 20/09/2026; antes so existia "Sair deste computador", que revoga -
  ou seja, o gestor precisava derrubar a recepcao para ver um numero). O shell limpa
  a sessao guardada e mostra a pagina publica; o cookie do dispositivo fica de pe,
  entao "Voltar para os laudos da unidade" - ou uma simples recarga - traz a recepcao
  de volta. E o caminho que torna CB-001 alcancavel pela interface.
- RF-022 (acrescentado em 20/09/2026, depois do cenario 3 em stage): quando a sessao
  **com senha** termina no navegador (logout do gestor), o shell reconsulta o
  dispositivo antes de mostrar a pagina publica. Nao vale quando foi o proprio gestor
  que pediu o formulario por RF-019 - ali a volta e decisao dele.
  Motivo: o bootstrap so roda na montagem, entao sair da sessao com senha deixava a
  maquina da recepcao exibindo um formulario de senha que a secretaria nao tem. A
  confianca continuava de pe e um F5 resolvia, mas ninguem sabe disso - e a ligacao
  para a Fort Cordis, que esta entrega existe para evitar, voltaria pela porta dos
  fundos.
- RF-020: em modo laudos, o cabecalho mostra "Conectado neste computador" e a acao
  "Sair deste computador".
- RF-021 (acrescentado em 20/09/2026, depois do cenario 6 em stage): quando ha
  sessao **de dispositivo** guardada no navegador, `/clinica-parceira` a reconfere
  com `POST /clinicas/dispositivo/sessao` **antes** de renderizar qualquer laudo, e
  descarta a sessao guardada se o servidor recusar. Sessao com senha nao passa por
  isso: ela tem o refresh proprio, e a precedencia de CB-001 fica de pe.
  Motivo: o token guardado vive ate meia hora, entao confiar nele fazia a revogacao
  administrativa so valer quando ele expirasse - e revogar existe justamente para
  maquina trocada, vendida ou roubada.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (contencao do escalonamento): abrir um link encaminhado permite criar
  confianca, mas o maximo que ela alcanca e o **acervo de laudos daquela clinica** -
  nunca financeiro, agenda ou recibos. E uma ampliacao consciente sobre o PR #171
  (que expunha um exame), contida por escopo, expiracao por inatividade, revogacao,
  amarracao ao navegador e aviso ao gerente.
- NFR-002 (compatibilidade da verificacao nova): toda sessao emitida hoje - senha,
  MFA, refresh e o fluxo legado de codigo - ja carrega `clinic:read`. A verificacao
  de escopo nasce, portanto, **sem efeito pratico** sobre quem ja usa o portal. Teste
  dedicado deve provar isso.
- NFR-003 (cookie): cookie proprio
  (`PORTAL_CLINIC_DEVICE_TRUST_COOKIE_NAME`, default
  `fortcordis_portal_clinic_device`), `HttpOnly`, `SameSite=Lax`, `Secure` conforme
  ambiente, para nao colidir com `fortcordis_portal_clinic_refresh` de um gerente
  logado na mesma maquina.
- NFR-004 (token em repouso): token de refresh opaco sorteado
  (`generate_opaque_token`), guardado so como hash, no mesmo padrao de
  `portal_clinic_sessions`. Aqui **nao** se usa derivacao por HMAC como no link de
  laudo: o cookie nao precisa ser reconstruido, entao sorteio puro e o mais simples
  e o mais seguro.
- NFR-005 (auditoria sem inundar): geram evento a criacao
  (`PORTAL_CLINIC_DEVICE_TRUSTED`), a revogacao (`PORTAL_CLINIC_DEVICE_REVOKED`) e a
  recusa por divergencia de navegador. A renovacao de rotina **nao** audita - so
  atualiza `last_seen_at` - porque a recepcao renova a cada carregamento de pagina
  por meses.
- NFR-006 (falha fechada): cookie invalido, expirado, revogado, de clinica inativa ou
  de outro navegador resulta em 401 generico e limpeza do cookie, sem distinguir os
  casos.
- NFR-007 (LGPD): o modo laudos expoe o mesmo conjunto de dados que a clinica ja ve
  hoje com senha na aba de exames - nao amplia dado nenhum, so muda a forma de
  autenticar.

## 4) Contratos tecnicos

### API

#### `POST /api/v1/portal/laudo-link/{token}/confiar-dispositivo` (publico)

- Payload: `{"device_label": "<texto opcional, ate 120 chars>"}`.
- Resposta 200:

```json
{
  "access_token": "<jwt de sessao do portal>",
  "token_type": "bearer",
  "expires_at": "2026-09-18T15:02:00",
  "actor_type": "clinica",
  "actor_id": 8,
  "clinica_id": 8,
  "clinica_nome": "Clinica Pet Sus",
  "scope": ["exam:read", "exam:download"],
  "trusted_until": "2026-11-17T15:02:00",
  "auth_method": "device_trust"
}
```

- Cookie de dispositivo gravado na resposta.
- Resposta 404 (mesma do link invalido) quando o link nao vale mais.

#### `POST /api/v1/portal/clinicas/dispositivo/sessao` (publico, por cookie)

- Payload: vazio. Resposta: igual a de cima (com `trusted_until` renovado).
- Resposta 401 `{"detail": "Dispositivo nao esta mais conectado."}` em qualquer
  recusa, sempre limpando o cookie.

#### `POST /api/v1/portal/clinicas/dispositivo/encerrar` (publico, por cookie)

- Resposta 200 `{"encerrado": true}`. Idempotente.

#### `POST /api/v1/portal/admin/clinica-dispositivos/revogar` (interno)

- Payload: `{"device_id": 12}` ou `{"clinica_id": 8}` (um dos dois).
- Resposta: `{"revogados": 2}`.

### Banco/migracoes

- Tabela nova `portal_clinic_trusted_devices`:
  - `id`, `clinica_id` (index), `refresh_token_hash` (VARCHAR(64), unico),
    `device_label` (VARCHAR(120)), `user_agent_hash` (VARCHAR(64)),
    `origin` (VARCHAR(20), `exam_link`), `origin_exam_link_id` (INTEGER, index),
    `scope_json` (TEXT), `status` (VARCHAR(20): `active` | `revoked` | `expired`),
    `expires_at` (index), `last_seen_at`, `created_at`, `revoked_at`,
    `revoked_reason` (VARCHAR(255)).
- Indices: unico em `refresh_token_hash`; indices em `clinica_id`, `status`,
  `expires_at`, `origin_exam_link_id`.
- Migracao: `backend/migrations/versions/20260918_88_portal_clinic_trusted_devices.py`.

### Frontend

- Telas afetadas: `/laudo/[token]` (acao nova), `/clinica-parceira` (login silencioso),
  `PortalClinicaWorkspace` (abas condicionais e cabecalho do modo laudos).
- Estados de UI: oferecendo confianca; conectando; conectado (modo laudos);
  falha ao conectar (mensagem generica, sem bloquear o download do laudo).
- Regras de exibicao: sem `clinic:read`, aba de financeiro e de agenda somem por
  completo - nao aparecem desabilitadas, para nao sugerir que basta insistir.

### Configuracao

- `PORTAL_CLINIC_DEVICE_TRUST_ENABLED: bool = False`
- `PORTAL_CLINIC_DEVICE_TRUST_INACTIVITY_DAYS: int = 30`
- `PORTAL_CLINIC_DEVICE_TRUST_COOKIE_NAME: str = "fortcordis_portal_clinic_device"`

## 5) Compatibilidade e rollout

- Backward compatibility: com a flag desligada, os tres endpoints novos respondem 404
  e a acao some da pagina do laudo. A **verificacao de escopo (RF-001 a RF-005) vale
  sempre**, inclusive com a flag desligada - e inofensiva porque toda sessao atual
  carrega `clinic:read`, e deixa-la atras de flag criaria dois comportamentos de
  autorizacao para manter.
- Feature flag: `PORTAL_CLINIC_DEVICE_TRUST_ENABLED`.
- Dependencia: `portal-clinica-link-laudo-whatsapp` (PR #171) precisa estar em
  `stage` antes desta implementacao.
- Rollback: desligar a flag corta a criacao de confiancas novas; as existentes
  continuam validas ate expirar ou serem revogadas. Para corte imediato, usar
  `POST /admin/clinica-dispositivos/revogar` por clinica.

## 6) Criterios de aceitacao (CA)

- CA-001: sessao emitida por login com senha continua acessando financeiro, agenda,
  recibos e exames sem mudanca (prova de NFR-002).
- CA-002: sessao em modo laudos acessa `GET /clinicas/exames` (com a fila
  operacional) e baixa anexo normalmente.
- CA-003: a mesma sessao recebe **403** em `/clinicas/financeiro`,
  `/clinicas/agendamentos`, no PATCH de cancelamento e no recibo de OS.
- CA-004: `confiar-dispositivo` com link valido cria a confianca, grava o cookie e
  devolve escopo exatamente `["exam:read", "exam:download"]`.
- CA-005: `confiar-dispositivo` com link revogado, exame despublicado ou clinica
  inativa devolve o mesmo 404 do link invalido, sem criar nada.
- CA-006: `dispositivo/sessao` renova o prazo, **rotaciona** o hash do refresh e o
  cookie anterior deixa de valer.
- CA-007: confianca sem uso alem do prazo de inatividade vira `expired` e devolve
  401 com o cookie limpo.
- CA-008: `dispositivo/sessao` vindo de outro `user_agent_hash` revoga a confianca e
  devolve 401.
- CA-009: revogar o link de laudo de origem revoga a confianca nascida dele.
- CA-010: `dispositivo/encerrar` revoga e e idempotente na segunda chamada.
- CA-011: criar a confianca dispara e-mail aos gestores, e falha de envio nao impede
  a conexao.
- CA-012: `GET /admin/clinicas/{id}/acesso` lista os dispositivos confiaveis, e o
  endpoint admin de revogacao corta por dispositivo e por clinica.
- CA-013: a criacao e a revogacao geram auditoria; a renovacao de rotina **nao**
  gera evento, so atualiza `last_seen_at`.
- CA-014: no frontend, `/clinica-parceira` entra direto quando ha cookie valido e cai
  no formulario de login quando nao ha.
- CA-015: em modo laudos as abas de financeiro e agenda nao sao renderizadas, e a
  acao "Sair deste computador" encerra a confianca.
- CA-016: com sessao de dispositivo guardada e ainda dentro do proprio prazo, revogar
  o computador (pelo admin ou pela unidade) derruba o acesso **na recarga seguinte**,
  sem esperar o token expirar; sessao com senha guardada nao dispara a reconferencia.
- CA-017: terminada a sessao com senha, a tela volta ao modo laudos **sem recarga**,
  desde que a confianca do computador continue valida.

## 7) Casos de borda

- CB-001: gerente com sessao de senha e recepcao com dispositivo confiavel no mesmo
  navegador - os dois cookies coexistem e a sessao com senha tem precedencia.
- CB-002: navegador em aba anonima ou com cookies bloqueados - a acao falha com
  mensagem clara e o download do laudo continua funcionando. Vale para os dois jeitos
  de falhar: o pedido recusado pelo servidor e o pedido aceito cujo cookie o navegador
  descarta (RF-023). O segundo so passou a ser coberto em 20/09/2026.
- CB-003: duas maquinas da mesma clinica confiaveis ao mesmo tempo - ambas validas e
  revogaveis em separado.
- CB-004: clinica desativada e reativada - a confianca anterior segue revogada.
- CB-005: `PORTAL_CLINIC_DEVICE_TRUST_ENABLED=false` com confiancas ja existentes -
  `dispositivo/sessao` continua honrando as existentes; so a criacao e cortada.
- CB-006: exame remanejado para outra clinica - a confianca e da clinica, nao do
  exame, e continua valida para o acervo da clinica original.
- CB-007: servidor sem resposta (rede fora) na reconferencia de RF-021 - a recepcao
  **continua** com a sessao guardada. Oscilacao de rede nao e recusa, e derrubar a
  unidade por causa dela custaria mais do que o risco que a reconferencia fecha.
- CB-008: logout do gestor com a confianca **tambem** vencida ou revogada - a
  retomada de RF-022 falha e a tela cai na pagina publica, que e o certo. O que nao
  pode e cair na pagina publica com a confianca ainda valida.

## 8) Fora de escopo

- Recuperacao de senha por WhatsApp.
- Acesso a financeiro, agenda ou recibos sem senha.
- Limite maximo de dispositivos confiaveis por clinica.
- Tela para a propria clinica listar e encerrar dispositivos (so a acao "sair deste
  computador" do proprio navegador entra agora).
- Modo laudos para o veterinario parceiro individual.
