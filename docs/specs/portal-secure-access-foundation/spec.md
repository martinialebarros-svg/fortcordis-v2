# Spec - portal-secure-access-foundation

Data: 2026-06-17
Responsavel: Equipe FortCordis
Status: done

## 1) Escopo funcional

Adicionar a fundacao backend do portal seguro da Fort Cordis. A entrega inclui desafio temporario para tutor e clinica parceira, envio real do codigo por provider configurado, verificacao de codigo com emissao de token de sessao do portal, listagem autorizada de exames por pet e download autenticado dos anexos vinculados ao exame. O fluxo deve ser independente do login administrativo existente e deve aceitar anexos tanto em disco local quanto em storage remoto definitivo acessivel pelo backend.

## 2) Requisitos funcionais (RF)

- RF-001: `POST /api/v1/portal/tutores/sessao-link` deve aceitar solicitacao de acesso para tutor e responder com mensagem generica anti-enumeracao.
- RF-002: `POST /api/v1/portal/clinicas/sessao-link` deve aceitar solicitacao de acesso para clinica parceira e responder com mensagem generica anti-enumeracao.
- RF-003: quando os dados informados corresponderem ao cadastro existente, o backend deve criar um desafio temporario com expiracao e limite de tentativas.
- RF-003a: quando houver match valido, o backend deve acionar o provider configurado para entregar o codigo pelo canal escolhido.
- RF-003b: na fase preliminar, o canal WhatsApp deve permanecer bloqueado por `PORTAL_WHATSAPP_ENABLED=false`, permitindo uso do portal por email ate a liberacao da API da Meta.
- RF-004: `POST /api/v1/portal/auth/verificar-codigo` deve validar o desafio e emitir token bearer do portal com escopo de tutor/pet ou clinica/unidade.
- RF-005: `GET /api/v1/portal/pets/{paciente_id}/exames` deve listar apenas exames autorizados para a sessao do portal.
- RF-006: `POST /api/v1/portal/exames/{exame_id}/download-url` deve retornar links de download autenticados para anexos do exame autorizados ao solicitante.
- RF-007: `GET /api/v1/portal/anexos/{anexo_id}/arquivo` deve baixar o arquivo somente quando houver token valido do portal ou token curto de download compativel com o anexo.
- RF-007a: quando o anexo estiver em URL remota absoluta, o backend deve fazer proxy autenticado do arquivo sem expor a URL do storage ao cliente do portal.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): o portal deve usar token proprio, separado do token administrativo interno.
- NFR-002 (LGPD): endpoints publicos de solicitacao nao devem revelar se tutor, pet ou clinica existem.
- NFR-003 (seguranca/download): downloads nao devem depender de `access_token` em query string.
- NFR-004 (auditoria): solicitacoes, validacoes e downloads devem registrar evento de auditoria best-effort.
- NFR-005 (compatibilidade): login administrativo atual e dependencias `get_current_user` nao devem ser quebrados.
- NFR-006 (storage): o portal deve suportar anexo em `caminho_arquivo` local e em `url` remota `http(s)` sem alterar o contrato publico do endpoint de download.

## 4) Contratos tecnicos

### API

- `POST /api/v1/portal/tutores/sessao-link`
  - payload:
    - `tutor_id`
    - `paciente_id`
    - `canal` (`email` | `whatsapp`)
    - `contato`
  - resposta:
    - `accepted`
    - `challenge_id`
    - `message`
    - `expires_in_seconds`
    - `debug_code` apenas quando configurado em ambiente nao produtivo

- `POST /api/v1/portal/clinicas/sessao-link`
  - payload:
    - `clinica_id`
    - `email`
    - `responsavel_nome`
  - resposta:
    - mesmo contrato generico acima

- `POST /api/v1/portal/auth/verificar-codigo`
  - payload:
    - `challenge_id`
    - `codigo`
  - resposta:
    - `access_token`
    - `token_type`
    - `expires_at`
    - `actor_type`
    - `actor_id`
    - `paciente_id`
    - `clinica_id`

- `GET /api/v1/portal/pets/{paciente_id}/exames`
  - auth:
    - bearer token do portal
  - resposta:
    - `items[]` com metadados do exame e anexos disponiveis

- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - auth:
    - bearer token do portal
  - resposta:
    - `items[]` com `anexo_id`, `download_url`, `download_token`, `expires_at`

- `GET /api/v1/portal/anexos/{anexo_id}/arquivo`
  - auth:
    - bearer token do portal ou header `x-portal-download-token`
  - resposta:
    - stream do arquivo

### Banco/migracoes

- Nova tabela:
  - `portal_access_challenges`
- Campos principais:
  - `challenge_id`
  - `actor_type`
  - `actor_id`
  - `paciente_id`
  - `clinica_id`
  - `responsavel_nome`
  - `canal`
  - `contato_mascarado`
  - `scope_json`
  - `contexto_json`
  - `code_hash`
  - `status`
  - `failed_attempts`
  - `max_attempts`
  - `expires_at`
  - `consumed_at`
- Migracao necessaria: sim

### Frontend

- Nenhuma tela funcional sera ligada nesta iteracao.
- O frontend futuro podera consumir estes endpoints sem alterar o login administrativo do app.

### Providers/infra

- Email real:
  - `PORTAL_EMAIL_SMTP_HOST`
  - `PORTAL_EMAIL_SMTP_PORT`
  - `PORTAL_EMAIL_SMTP_USERNAME`
  - `PORTAL_EMAIL_SMTP_PASSWORD`
  - `PORTAL_EMAIL_SMTP_USE_TLS`
  - `PORTAL_EMAIL_SMTP_USE_SSL`
  - `PORTAL_EMAIL_FROM_EMAIL`
  - `PORTAL_EMAIL_FROM_NAME`
  - `PORTAL_EMAIL_SUBJECT`
- WhatsApp real por webhook:
  - `PORTAL_WHATSAPP_ENABLED`
  - `PORTAL_WHATSAPP_WEBHOOK_URL`
  - `PORTAL_WHATSAPP_WEBHOOK_METHOD`
  - `PORTAL_WHATSAPP_WEBHOOK_AUTH_HEADER`
  - `PORTAL_WHATSAPP_WEBHOOK_AUTH_TOKEN`
  - `PORTAL_WHATSAPP_WEBHOOK_TIMEOUT_SECONDS`
- Storage remoto:
  - `PORTAL_REMOTE_STORAGE_AUTH_HEADER`
  - `PORTAL_REMOTE_STORAGE_AUTH_TOKEN`
  - `PORTAL_REMOTE_STORAGE_TIMEOUT_SECONDS`

## 5) Compatibilidade e rollout

- Backward compatibility:
  - endpoints administrativos atuais permanecem inalterados;
  - token interno existente continua sendo o unico aceito em rotas administrativas;
  - token do portal vale apenas para `/api/v1/portal`.
- Feature flag:
  - opcional apenas para exposicao de `debug_code` em ambiente nao produtivo.
- Estrategia de rollback:
  - remover router do portal e reverter migracao/modelo da tabela de desafios.

## 6) Criterios de aceitacao (CA)

- CA-001: solicitacao valida de tutor cria desafio pendente e retorna resposta generica.
- CA-002: solicitacao invalida de tutor retorna resposta generica sem revelar inexistencia.
- CA-003: codigo valido em desafio pendente emite token bearer do portal com escopo correto.
- CA-004: codigo invalido incrementa tentativa e bloqueia desafio ao exceder limite.
- CA-005: tutor autenticado pelo portal so consegue listar exames do pet presente no proprio escopo.
- CA-006: clinica autenticada pelo portal so consegue listar exames vinculados a sua unidade.
- CA-007: download de anexo exige autorizacao valida do portal.
- CA-008: suite de testes alvo passa localmente.

## 7) Casos de borda

- CB-001: desafio expirado.
- CB-002: desafio ja consumido.
- CB-003: clinica sem anexo de exame disponivel.
- CB-004: exame sem contexto suficiente de clinica deve ser negado para sessao de clinica.
- CB-005: token de download de anexo com `anexo_id` divergente da rota.

## 8) Fora de escopo

- Painel administrativo de convites do portal.
- Cadastro nominal definitivo de usuarios da clinica.
- UI do portal consumindo os endpoints.
- Provisionamento de credenciais reais do provider e onboarding do vendor externo em cada ambiente.
- Liberacao da API WhatsApp Business pela Meta e ativacao de `PORTAL_WHATSAPP_ENABLED=true`.
- Upload direto para object storage vendor-specific dentro do fluxo administrativo de anexos.
