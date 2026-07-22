# Spec - portal-access-ui

Data: 2026-07-21
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
- RF-010: o app administrativo deve oferecer uma pagina panoramica em `/clinicas/portal` com o status de acesso das clinicas parceiras.
- RF-011: a pagina panoramica deve destacar clinicas com convite pendente, clinicas sem convite, clinicas que precisam informar email e clinicas com conta bloqueada.
- RF-012: o cockpit administrativo deve permitir gerar ou reenviar convite da clinica sem sair da tela panoramica.
- RF-013: o cockpit administrativo deve permitir revogar convite pendente, encerrar sessoes ativas e revogar conta da clinica com confirmacao explicita.
- RF-014: o cockpit administrativo deve exibir feed recente de downloads de laudos pelas clinicas parceiras.
- RF-015: o cockpit administrativo deve permitir exportar a visao filtrada em CSV.
- RF-016: o cockpit administrativo deve exibir indicadores de adesao e inatividade do portal com base em contas ativas, ultimo login e ultimo download.
- RF-017: o cockpit administrativo deve destacar visualmente clinicas ativas sem acesso por 30 dias ou mais.
- RF-018: o cockpit administrativo deve permitir reenviar convite diretamente na lista, reaproveitando email institucional e WhatsApp ja conhecidos.
- RF-019: o cockpit administrativo deve permitir filtrar clinicas que ja concluíram o primeiro download de laudo no portal.
- RF-020: cada clinica da lista deve exibir uma linha do tempo resumida com convites, ativacao, revogacoes e downloads auditados.
- RF-021: a exportacao CSV do cockpit deve incluir primeiro download, ultimo acesso, dias sem atividade e dados do convite mais recente.
- RF-022: links do portal compartilhados por WhatsApp devem expor metadata institucional com logomarca oficial da Fort Cordis no host `app.fortcordis.com.br`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/storage): a sessao do portal deve ser persistida em `sessionStorage`, separada por perfil (`tutor` e `clinica`), sem reusar o token administrativo.
- NFR-002 (seguranca/download): downloads devem usar o header curto retornado por `/download-url`, sem token sensivel em query string.
- NFR-003 (UX): formularios devem apresentar estados claros de carregamento, sucesso e erro.
- NFR-004 (compatibilidade): a integracao deve usar os rewrites atuais do Next.js para `/api/v1`.
- NFR-005 (qualidade): build do frontend deve seguir passando apos a integracao.
- NFR-006 (rollout preliminar): a UI do tutor deve operar em modo email-only enquanto a API WhatsApp Business aguarda liberacao na Meta.
- NFR-007 (copy): labels, mensagens e estados visiveis dos portais do tutor e da clinica devem usar grafia correta em portugues, sem alterar nomes de campos ou payloads da API.
- NFR-008 (auditabilidade): downloads de anexos por clinicas devem registrar contexto minimo de auditoria (`actor_type`, `clinica_id`, `account_id`) para alimentar o painel administrativo.
- NFR-009 (seguranca operacional): acoes de revogar convite, encerrar sessoes e revogar conta devem exigir confirmacao na UI antes da chamada de API.
- NFR-010 (observabilidade operacional): indicadores do painel devem ser calculados apenas com dados do escopo da propria unidade/autenticacao sem ampliar permissao de leitura.
- NFR-011 (operacao): o reenvio rapido do convite deve falhar com mensagem clara quando faltarem email institucional ou WhatsApp da clinica.
- NFR-012 (branding compartilhado): o layout raiz do app deve publicar `metadataBase`, `openGraph`, `twitter` e `icons` coerentes para que previews de compartilhamento mostrem a identidade visual correta da Fort Cordis.
- NFR-013 (robustez temporal): o cockpit administrativo deve tolerar timestamps do banco com e sem timezone no mesmo payload, normalizando as datas do painel antes de calcular inatividade, downloads recentes e ordenacao da linha do tempo.

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

- `GET /api/v1/portal/admin/clinicas/acessos/painel`
  - auth:
    - papel administrativo interno
  - response:
    - `generated_at`
    - `metrics`
    - `items[]` com status, conta, convite, sessoes e downloads por clinica
    - `items[].login_email`
    - `items[].first_download_at`
    - `items[].last_access_at`
    - `items[].days_since_last_activity`
    - `items[].timeline[]` com `event_type`, `title`, `description`, `occurred_at` e `tone`
    - `recent_downloads[]` com feed recente auditado
    - `recent_downloads[].is_first_download`

- `POST /api/v1/portal/admin/clinicas/{clinica_id}/convites`
  - auth:
    - papel administrativo interno
  - request:
    - `delivery_channel`
    - `delivery_target`
    - `account_email`
    - `expires_in_hours`
    - `allow_manual_copy`
  - response:
    - `activation_url`
    - `delivery_status`
    - `account_email_masked`

- `POST /api/v1/portal/admin/clinicas/{clinica_id}/convites/{invite_id}/revogar`
  - auth:
    - papel administrativo interno

- `POST /api/v1/portal/admin/clinica-sessions/revogar`
  - auth:
    - papel administrativo interno

- `POST /api/v1/portal/admin/clinica-accounts/{account_id}/revogar`
  - auth:
    - papel administrativo interno

### Banco/migracoes

- Nenhuma alteracao nova nesta iteracao.
- Dependencia da fase anterior:
  - `portal_access_challenges`
- Reuso complementar:
  - `auditoria_eventos` para panorama de downloads sem migracao nova.

### Frontend

- Telas afetadas:
  - `frontend/app/area-pacientes/page.tsx`
  - `frontend/app/clinica-parceira/page.tsx`
  - `frontend/app/clinica-parceira/ativar/[token]/page.tsx`
  - `frontend/app/clinica-parceira/redefinir-senha/page.tsx`
  - `frontend/app/clinicas/page.tsx`
  - `frontend/app/clinicas/portal/page.tsx`
- Componentes novos/alterados:
  - `frontend/app/layout.tsx`
  - `frontend/components/portal/PortalTutorWorkspace.tsx`
  - `frontend/components/portal/PortalClinicaWorkspace.tsx`
  - `frontend/components/portal/PortalClinicActivationWorkspace.tsx`
  - `frontend/components/portal/PortalClinicResetPasswordWorkspace.tsx`
  - `frontend/components/portal/PortalExamResults.tsx`
  - `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx`
  - `frontend/lib/portal-clinic-admin.ts`
  - `frontend/lib/portal-api.ts`
- Regras de exibicao/erro:
  - permitir codigo de desenvolvimento apenas quando o backend expuser `debug_code`;
  - validar IDs numericos antes de chamar a API;
  - exibir mensagem vazia quando nenhum exame autorizado existir;
  - encerrar somente a sessao do portal ao clicar em sair;
  - mostrar confirmacao antes de revogar convite, conta ou sessoes;
  - exportar somente a visao atualmente filtrada no cockpit administrativo.

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
- CA-011: formularios, estados e resultados dos portais do tutor e da clinica exibem acentos e cedilhas corretamente, preservando os contratos do portal.
- CA-012: a tela `/clinicas/portal` exibe metricas e lista panoramica coerentes com os convites, contas e sessoes existentes.
- CA-013: a tela `/clinicas/portal` permite gerar convite e disponibiliza link e mensagem prontos para encaminhamento.
- CA-014: a tela `/clinicas/portal` permite revogar convite, encerrar sessoes e revogar conta com retorno visual do resultado.
- CA-015: o feed recente de downloads mostra apenas eventos auditados de clinicas.
- CA-016: a exportacao CSV reflete a lista filtrada atualmente visivel.
- CA-017: a taxa de adesao e o indicador de inatividade de 30 dias refletem as contas ativas e a ultima atividade do portal.
- CA-018: clinica ativa sem acesso por 30 dias ou mais aparece com alerta visual no cockpit.
- CA-019: a lista permite reenviar convite diretamente quando email institucional e WhatsApp ja estiverem disponiveis.
- CA-020: o filtro por primeiro download mostra apenas clinicas que ja baixaram ao menos um laudo.
- CA-021: cada card de clinica exibe linha do tempo resumida com historico auditado de convite, conta e download.
- CA-022: o CSV exportado inclui primeiro download, ultimo acesso e dias sem atividade.
- CA-023: um link compartilhado do portal gera preview institucional com nome, descricao e logomarca oficial da Fort Cordis.
- CA-024: a tela `/clinicas/portal` continua carregando metricas, downloads recentes e linha do tempo mesmo quando a auditoria trouxer timestamps timezone-aware misturados com timestamps sem timezone.

## 7) Casos de borda

- CB-001: `debug_code` ausente em ambiente nao exposto deve manter a UI funcional.
- CB-002: ID informado com valor invalido deve ser bloqueado antes da chamada de API.
- CB-003: sessao expirada em `sessionStorage` deve ser descartada no load da pagina.
- CB-004: clinica autenticada sem exames liberados para o pet consultado deve ver estado vazio claro.
- CB-005: anexo sem item correspondente em `/download-url` deve falhar com mensagem amigavel.
- CB-006: WhatsApp indisponivel deve ficar oculto na UI do tutor ate a flag backend ser habilitada.
- CB-007: evento de download antigo sem `actor_type=clinica` nao deve contaminar o feed administrativo.
- CB-008: clinica sem email salvo, sem convite e sem conta deve aparecer como pendencia de email no cockpit.
- CB-009: conta ativa sem login nem download recente por 30 dias deve contar como inativa no indicador administrativo.
- CB-010: clinica com conta ativa, mas sem email/WhatsApp suficientes para reenvio rapido, deve orientar o operador a completar os dados no compositor.
- CB-011: um link ja compartilhado pode continuar com preview antigo ate o cache externo do mensageiro expirar; novos compartilhamentos devem usar a metadata vigente do host.

## 8) Fora de escopo

- Provider real de WhatsApp para envio do codigo.
- Multiunidade na mesma sessao de clinica.
- Preview inline de laudos/PDF.
- Automacao proativa de relacionamento com clinicas inativas.
