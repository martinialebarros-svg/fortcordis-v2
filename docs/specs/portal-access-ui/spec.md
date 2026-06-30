# Spec - portal-access-ui

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Escopo funcional

Ligar as paginas publicas de tutor e clinica parceira ao backend do portal seguro da Fort Cordis. A entrega inclui formularios de solicitacao de codigo, verificacao de codigo, persistencia isolada da sessao do portal no navegador, listagem de exames autorizados e download autenticado de anexos a partir dos endpoints `/api/v1/portal`.

## 2) Requisitos funcionais (RF)

- RF-001: `/area-pacientes` deve permitir solicitar um codigo temporario para tutor usando `tutor_id`, `paciente_id` e email cadastrado.
- RF-002: `/area-pacientes` deve permitir validar o codigo recebido e abrir a sessao do pet autorizado.
- RF-003: tutor autenticado deve conseguir listar apenas os exames do pet autorizado pelo token do portal.
- RF-004: tutor autenticado deve conseguir baixar anexos liberados para os exames do pet.
- RF-005: `/clinica-parceira` deve permitir solicitar um codigo temporario usando `clinica_id`, `email` e `responsavel_nome`.
- RF-006: `/clinica-parceira` deve permitir validar o codigo recebido e abrir a sessao da unidade autenticada.
- RF-007: clinica autenticada deve conseguir consultar exames de um pet sem sair do escopo da unidade validada pelo backend.
- RF-008: clinica autenticada deve conseguir baixar anexos liberados para os exames autorizados.
- RF-009: a sessao do portal deve poder ser encerrada no navegador sem afetar o login administrativo interno.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/storage): a sessao do portal deve ser persistida em `sessionStorage`, separada por perfil (`tutor` e `clinica`), sem reusar o token administrativo.
- NFR-002 (seguranca/download): downloads devem usar o header curto retornado por `/download-url`, sem token sensivel em query string.
- NFR-003 (UX): formularios devem apresentar estados claros de carregamento, sucesso e erro.
- NFR-004 (compatibilidade): a integracao deve usar os rewrites atuais do Next.js para `/api/v1`.
- NFR-005 (qualidade): build do frontend deve seguir passando apos a integracao.
- NFR-006 (rollout preliminar): a UI do tutor deve operar em modo email-only enquanto a API WhatsApp Business aguarda liberacao na Meta.

## 4) Contratos tecnicos

### API

- `POST /api/v1/portal/tutores/sessao-link`
  - request:
    - `tutor_id`
    - `paciente_id`
    - `canal` fixo como `email` na fase preliminar
    - `contato` com email cadastrado
  - response:
    - `challenge_id`
    - `message`
    - `expires_in_seconds`
    - `debug_code` opcional

- `POST /api/v1/portal/clinicas/sessao-link`
  - request:
    - `clinica_id`
    - `email`
    - `responsavel_nome`
  - response:
    - `challenge_id`
    - `message`
    - `expires_in_seconds`
    - `debug_code` opcional

- `POST /api/v1/portal/auth/verificar-codigo`
  - request:
    - `challenge_id`
    - `codigo`
  - response:
    - `access_token`
    - `token_type`
    - `expires_at`
    - `actor_type`
    - `actor_id`
    - `paciente_id`
    - `clinica_id`
    - `scope`

- `GET /api/v1/portal/pets/{paciente_id}/exames`
  - auth:
    - `Authorization: Bearer <portal token>`
  - response:
    - `items[]` com metadados do exame e anexos liberados

- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - auth:
    - `Authorization: Bearer <portal token>`
  - response:
    - `items[]` com `anexo_id`, `download_url`, `download_token`, `download_token_header`

### Banco/migracoes

- Nenhuma alteracao nova nesta iteracao.
- Dependencia da fase anterior:
  - `portal_access_challenges`

### Frontend

- Telas afetadas:
  - `frontend/app/area-pacientes/page.tsx`
  - `frontend/app/clinica-parceira/page.tsx`
- Componentes novos/alterados:
  - `frontend/components/portal/PortalTutorWorkspace.tsx`
  - `frontend/components/portal/PortalClinicaWorkspace.tsx`
  - `frontend/components/portal/PortalExamResults.tsx`
  - `frontend/lib/portal-api.ts`
- Regras de exibicao/erro:
  - permitir codigo de desenvolvimento apenas quando o backend expuser `debug_code`;
  - validar IDs numericos antes de chamar a API;
  - exibir mensagem vazia quando nenhum exame autorizado existir;
  - encerrar somente a sessao do portal ao clicar em sair.

## 5) Compatibilidade e rollout

- Backward compatibility:
  - login administrativo via `frontend/lib/axios.ts` permanece inalterado;
  - storage do portal fica isolado do storage do app administrativo;
  - rotas e copy institucionais existentes permanecem.
- Feature flag:
  - nao.
- Estrategia de rollback:
  - remover os componentes de workspace e voltar as paginas publicas para o estado estatico anterior.

## 6) Criterios de aceitacao (CA)

- CA-001: tutor consegue solicitar um codigo temporario a partir da UI.
- CA-002: tutor consegue validar o codigo e ver a sessao do pet autorizada.
- CA-003: tutor autenticado consegue listar exames do pet autorizado.
- CA-004: tutor autenticado consegue iniciar download de anexo liberado.
- CA-005: clinica consegue solicitar um codigo temporario a partir da UI.
- CA-006: clinica consegue validar o codigo e ver a sessao da unidade autenticada.
- CA-007: clinica autenticada consegue consultar exames de um pet e ver apenas os exames liberados a sua unidade.
- CA-008: clinica autenticada consegue iniciar download de anexo liberado.
- CA-009: logout do portal nao remove a autenticacao administrativa interna.
- CA-010: build do frontend passa localmente.

## 7) Casos de borda

- CB-001: `debug_code` ausente em ambiente nao exposto deve manter a UI funcional.
- CB-002: ID informado com valor invalido deve ser bloqueado antes da chamada de API.
- CB-003: sessao expirada em `sessionStorage` deve ser descartada no load da pagina.
- CB-004: clinica autenticada sem exames liberados para o pet consultado deve ver estado vazio claro.
- CB-005: anexo sem item correspondente em `/download-url` deve falhar com mensagem amigavel.
- CB-006: WhatsApp indisponivel deve ficar oculto na UI do tutor ate a flag backend ser habilitada.

## 8) Fora de escopo

- Provider real de WhatsApp para envio do codigo.
- Multiunidade na mesma sessao de clinica.
- Preview inline de laudos/PDF.
- Automacao de convite, gestao de contas ou painel de suporte.
