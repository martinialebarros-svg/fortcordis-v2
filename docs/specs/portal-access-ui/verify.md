# Verify - portal-access-ui

Data: 2026-07-21
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + QA manual em `http://127.0.0.1:3004/area-pacientes` com sessao ativa do tutor e pet `201` | ok |
| CA-002 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + `backend/tests/test_portal_access_http_flow.py::test_tutor_http_flow_lists_and_downloads_attachment` | ok |
| CA-003 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + `frontend/components/portal/PortalExamResults.tsx` + exame `Ecocardiograma` listado no navegador | ok |
| CA-004 | aceitacao | `frontend/components/portal/PortalTutorWorkspace.tsx` + `frontend/lib/portal-api.ts` + download validado por token HTTP curto | ok |
| CA-005 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + QA manual em `http://127.0.0.1:3004/clinica-parceira` com unidade `301` autenticada | ok |
| CA-006 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `backend/tests/test_portal_access_http_flow.py::test_clinic_http_flow_filters_scope_and_downloads_attachment` | ok |
| CA-007 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `frontend/components/portal/PortalExamResults.tsx` + consulta do pet `201` na unidade autorizada | ok |
| CA-008 | aceitacao | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `frontend/lib/portal-api.ts` + download de anexo validado por HTTP local | ok |
| CA-009 | aceitacao | `frontend/lib/portal-api.ts` com storage separado por perfil | ok |
| CA-010 | aceitacao | `npm run build` | ok |
| NFR-001 | nao funcional | `frontend/lib/portal-api.ts` isolando sessao por ator | ok |
| NFR-002 | nao funcional | `frontend/lib/portal-api.ts` usando `download_token_header` em download | ok |
| NFR-003 | nao funcional | estados de `loading`, `message` e `error` nos workspaces + validacao local de IDs invalidos | ok |
| NFR-004 | nao funcional | rewrites existentes do Next.js para `/api/v1` | ok |
| NFR-005 | nao funcional | `npm run build` | ok |
| NFR-006 | nao funcional | `frontend/components/portal/PortalTutorWorkspace.tsx` fixa canal `email` e remove seletor de WhatsApp da UI preliminar | ok |
| NFR-007 | nao funcional | Varredura das strings visiveis de `PortalTutorWorkspace`, `PortalExamResults`, `PortalClinicaWorkspace`, `PortalClinicActivationWorkspace` e `PortalClinicResetPasswordWorkspace` sem termos sem diacriticos necessarios | ok |
| CA-011 | aceitacao | QA local de `/area-pacientes` e `/clinica-parceira` confirmou labels e mensagens acentuadas em desktop e mobile | ok |
| CA-012 | aceitacao | `GET /api/v1/portal/admin/clinicas/acessos/painel` + `frontend/app/clinicas/portal/page.tsx` renderizando metricas, filtros e lista panoramica | ok |
| CA-013 | aceitacao | `frontend/app/clinicas/portal/page.tsx` + `frontend/lib/portal-clinic-admin.ts` com convite, link e mensagem reutilizando o endpoint administrativo | ok |
| CA-014 | aceitacao | `frontend/app/clinicas/portal/page.tsx` acionando revogacao de convite, sessoes e conta com confirmacao local | ok |
| CA-015 | aceitacao | `backend/app/api/v1/endpoints/portal.py` + `backend/app/api/v1/endpoints/portal_clinic_auth.py` + `test_admin_can_load_portal_access_overview_with_download_analytics` | ok |
| CA-016 | aceitacao | `frontend/app/clinicas/portal/page.tsx` exportando CSV da visao filtrada localmente | ok |
| CA-017 | aceitacao | calculos de adesao/inatividade em `frontend/app/clinicas/portal/page.tsx` combinando ultimo login e ultimo download | ok |
| CA-018 | aceitacao | alerta visual por clinica inativa em `frontend/app/clinicas/portal/page.tsx` usando `days_since_last_activity` do backend | ok |
| CA-019 | aceitacao | reenvio rapido pela propria lista em `frontend/app/clinicas/portal/page.tsx` reutilizando `POST /api/v1/portal/admin/clinicas/{clinica_id}/convites` | ok |
| CA-020 | aceitacao | filtros `Primeiro download` e checkbox de primeiro download no cockpit administrativo | ok |
| CA-021 | aceitacao | linha do tempo por clinica baseada em `timeline[]` do endpoint administrativo | ok |
| CA-022 | aceitacao | CSV analitico com `first_download_at`, `last_access_at` e `days_since_last_activity` | ok |
| CA-023 | aceitacao | `frontend/app/layout.tsx` publicando `metadataBase`, `openGraph`, `twitter` e `icons` para o host `https://app.fortcordis.com.br` com a logomarca oficial | ok |
| CA-024 | aceitacao | `backend/app/api/v1/endpoints/portal_clinic_auth.py::_normalize_utc_naive_datetime` + `test_portal_overview_datetime_helpers_normalize_mixed_timezones` cobrindo timestamps mistos no cockpit | ok |
| CA-025 | aceitacao | `backend/tests/test_portal_access_foundation.py::test_clinica_exam_list_includes_operational_panel` valida `operational_summary`, inclusive uma liberacao as 23:30 de Fortaleza gravada como 02:30 UTC do dia seguinte | ok |
| CA-026 | frontend | `frontend/components/portal/PortalClinicaWorkspace.tsx` renderiza a fila operacional com status e previsao/data de liberacao | ok |
| CA-027 | frontend | `frontend/components/portal/PortalClinicaPageShell.tsx` + `frontend/components/portal/PortalClinicaWorkspace.tsx` alternando entre landing publica e shell autenticado sem sobreposicao | ok |
| CA-028 | frontend | `PortalClinicaPageShell` reutiliza a sessao ja hidratada em `standalone` e `PortalClinicaWorkspace` so notifica o shell pai apos concluir o bootstrap local, evitando piscar entre landing e dashboard | ok |
| CA-029 | frontend | `frontend/components/portal/PortalClinicaWorkspace.tsx` + `frontend/app/globals.css` mantem o card `Sessao ativa` legivel dentro do hero autenticado da clinica | ok |
| CA-030 | aceitacao | `frontend/app/clinicas/portal/espelho/page.tsx` + `frontend/components/portal/PortalClinicaWorkspace.tsx` em `mode="admin_preview"` + `backend/tests/test_portal_access_foundation.py::test_admin_mirror_reuses_clinic_portal_scope_and_downloads` | ok |
| CA-031 | frontend | `frontend/app/clinicas/portal/page.tsx` formata o WhatsApp como `(00) 00000-0000` ao carregar, digitar ou colar e limita a entrada visual a 15 caracteres | ok |
| CA-032 | autorizacao | `backend/tests/test_portal_clinic_invite_auth.py::test_secretaria_e_recepcao_podem_gerar_convite_sem_poder_revogar` valida painel, criacao de convite e negativa `403` para revogacao | ok |
| NFR-008 | nao funcional | auditoria de download enriquecida com `actor_type`, `clinica_id` e `account_id` em `backend/app/api/v1/endpoints/portal.py` | ok |
| NFR-009 | nao funcional | confirmacoes explicitas antes de revogacoes no cockpit administrativo | ok |
| NFR-010 | nao funcional | painel calcula metricas somente a partir dos dados de acesso ja autorizados no backend | ok |
| NFR-011 | nao funcional | reenvio rapido orienta completar email/WhatsApp no compositor quando faltarem dados minimos | ok |
| NFR-012 | nao funcional | `frontend/app/layout.tsx` com metadata institucional coerente para previews de compartilhamento | ok |
| NFR-013 | nao funcional | normalizacao defensiva de timestamps do cockpit antes de comparar recencia, ultimo acesso e ordem da linha do tempo | ok |
| NFR-015 | nao funcional | shell exclusivo em `/clinica-parceira`, sem camadas publicas concorrentes durante sessao autenticada | ok |
| NFR-016 | nao funcional | bootstrap da sessao autenticada nao propaga `null` transitorio para o roteamento da pagina | ok |
| NFR-017 | nao funcional | hero autenticado restringe contraste invertido ao bloco institucional e preserva cards de apoio com fundo claro e texto escuro | ok |
| NFR-018 | nao funcional | rotas administrativas de espelho reutilizam `listar_exames_clinica_portal` e `gerar_download_url_exame_portal`, evitando duplicacao do motor de escopo da clinica | ok |
| NFR-019 | nao funcional | `normalizarWhatsappsParaApi` remove a mascara antes de montar `delivery_target` no convite administrativo | ok |
| NFR-020 | seguranca | `recepcao`/`secretaria` so usam as rotas de leitura e criacao de convite; as dependencias das revogacoes continuam em `_require_portal_admin` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/bin/python -m unittest backend/tests/test_portal_clinic_invite_auth.py
env PYTHONPYCACHEPREFIX=/private/tmp/fortcordis-pycache python3 -m py_compile backend/app/api/v1/endpoints/portal_clinic_auth.py backend/tests/test_portal_clinic_invite_auth.py

cd frontend
npx eslint app/layout.tsx
npx eslint app/clinicas/portal/page.tsx app/clinicas/page.tsx app/clinicas/components/ClinicaPortalAccessCard.tsx app/layout-dashboard.tsx lib/portal-api.ts lib/portal-clinic-admin.ts
npx eslint app/clinicas/portal/espelho/page.tsx components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts --max-warnings=0
npx eslint app/clinica-parceira/page.tsx components/portal/PortalClinicaWorkspace.tsx components/portal/PortalClinicaPageShell.tsx --max-warnings=0
npx tsc --noEmit --pretty false
npm run build
git diff --check
```

Resumo dos resultados:
- Backend:
  - `cd backend && venv/bin/python -m unittest tests/test_laudo_portal_release.py tests/test_portal_access_foundation.py -v`: 16/16 pass
  - `cd backend && venv/bin/python -m unittest tests/test_portal_access_foundation.py -v`: 10/10 pass
  - `test_portal_clinic_invite_auth`: 6/6 pass
  - `py_compile` de `portal_clinic_auth.py` e `test_portal_access_foundation.py`: ok
- Frontend:
  - `npx eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts app/laudos/page.tsx 'app/laudos/[id]/page.tsx' --max-warnings=0`: ok
  - `npx eslint app/layout.tsx`: ok
  - `npx eslint ...`: ok
  - `npx eslint app/clinicas/portal/espelho/page.tsx components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts --max-warnings=0`: ok
  - `npx eslint app/clinica-parceira/page.tsx components/portal/PortalClinicaWorkspace.tsx components/portal/PortalClinicaPageShell.tsx --max-warnings=0`: ok
  - `npx tsc --noEmit --pretty false`: ok
  - `npm run build`: ok
- Qualidade de diff:
  - `git diff --check`: ok

## 3) Testes manuais

- Executados:
  - render desktop e mobile de `http://127.0.0.1:3004/area-pacientes`;
  - render desktop e mobile de `http://127.0.0.1:3004/clinica-parceira`;
  - validacao local de erro de ID invalido no formulario do tutor;
  - tutor em modo email-only, sem opcao de WhatsApp visivel enquanto a API da Meta nao esta liberada;
  - validacao local de erro de ID invalido no formulario da clinica;
  - tutor com sessao ativa no navegador, pet `201`, exame `Ecocardiograma` e anexo `eco-luna-demo.pdf` visiveis;
  - clinica parceira com solicitacao de codigo, sessao validada para unidade `301`, consulta do pet `201` e exame `Ecocardiograma` visivel no navegador;
  - download do anexo validado via HTTP local porque o browser embutido nao suporta evento de download.
- Pendente:
  - nenhum bloqueador funcional nesta iteracao.

### Refinamento de 2026-07-12

- Formulario do tutor renderizado sem envio de IDs, email ou codigo.
- Resultados e estados autenticados revisados por codigo, sem criar sessao nem iniciar download.
- Login, ativacao, redefinicao de senha e estados autenticados da clinica revisados sem enviar formularios.
- Estado `Esqueci minha senha` aberto e fechado localmente; copy acentuada confirmada sem envio de email.
- `/clinica-parceira` validada em 1280x720 e 390x844, sem overflow horizontal ou erros no console.
- Lint e typecheck concluidos sem erros.
- Build do frontend concluido com 33 paginas compiladas.

### Refinamento administrativo de 2026-07-21

- `/clinicas/portal` validada localmente com resposta HTTP `200`.
- Filtros por status, fila rapida e opcao `Mostrar apenas quem ja baixou laudo` revisados por codigo.
- Exportacao CSV revisada por codigo para refletir somente a lista filtrada.
- Revogacao de convite, revogacao de conta e encerramento de sessoes revisados por codigo com confirmacao antes da chamada de API.
- Reuso do convite administrativo individual pela tela panoramica confirmado em `frontend/lib/portal-clinic-admin.ts` e `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx`.
- Feed de downloads validado com auditoria de `actor_type=clinica` coberta por teste automatizado.
- Reenvio rapido, filtro de primeiro download, alerta de inatividade e linha do tempo por clinica revisados por codigo.
- Payload administrativo `GET /api/v1/portal/admin/clinicas/acessos/painel` ampliado com `login_email`, `first_download_at`, `last_access_at`, `days_since_last_activity`, `timeline[]` e `recent_downloads[].is_first_download`.

### Refinamento de compartilhamento de 2026-07-22

- `frontend/app/layout.tsx` revisado para publicar `metadataBase`, `openGraph`, `twitter` e `icons` apontando para a logomarca oficial em `/brand/fortcordis-logo-oficial.png`.
- Confirmado por codigo que o host canonico do preview esta configurado como `https://app.fortcordis.com.br`.
- Observacao operacional: mensageiros podem manter cache do preview antigo por algum tempo; o comportamento esperado e que novos compartilhamentos passem a refletir a metadata publicada.

### Ajuste de shell autenticado de 2026-07-23

- `frontend/app/clinica-parceira/page.tsx` passou a delegar a decisao de shell para `PortalClinicaPageShell`.
- `PortalClinicaPageShell` revisado para mostrar a landing publica apenas sem sessao da clinica e substituir a tela integralmente pelo workspace autenticado quando a sessao existe.
- `PortalClinicaWorkspace` revisado para operar em dois modos: `embedded` na landing publica e `standalone` no ambiente autenticado.
- `http://127.0.0.1:3005/clinica-parceira` respondeu `200` durante a validacao local apos o ajuste.
- Revisao por codigo confirmou a remocao do container `fixed inset-0` no estado autenticado, eliminando a camada concorrente que deixava textos institucionais visiveis sob a area logada.

### Correcao do bootstrap autenticado de 2026-07-23

- Causa do incidente em producao confirmada por codigo: `PortalClinicaWorkspace` notificava `onSessionChange(null)` durante o proprio mount em `mode="standalone"`, antes de concluir a hidratacao da sessao local.
- Impacto observado: a shell de `/clinica-parceira` alternava entre landing publica e dashboard autenticado, causando piscar, sobreposicao de textos institucionais e rolagem inconsistente.
- Correcao aplicada:
  - `PortalClinicaPageShell` passou a reutilizar a sessao ja hidratada via prop `initialSession` ao montar o workspace standalone.
  - `PortalClinicaWorkspace` passou a adiar o callback `onSessionChange` ate o fim do bootstrap local.
- Validacao por codigo confirma que o shell autenticado nao derruba mais o estado pai para `null` no primeiro render com sessao valida.

### Ajuste de legibilidade do hero autenticado de 2026-07-23

- Causa confirmada por codigo: o seletor global `.fc-clinic-dashboard main > section:first-child` ainda estiliza genericamente o primeiro `section` do dashboard autenticado, inclusive o card `Sessao ativa`.
- Impacto observado: o hero institucional aplicava texto branco tambem sobre o card lateral claro, deixando a sessao praticamente invisivel e reforcando blocos brancos sem contexto.
- Correcao aplicada:
  - `PortalClinicaWorkspace` passou a marcar explicitamente o hero, o kicker institucional e o card `Sessao ativa`.
  - `frontend/app/globals.css` passou a estilizar essas partes por classes dedicadas, removendo a heranca global de contraste invertido.
- Validacao por codigo confirma que o gradiente e o contraste alto ficam restritos ao bloco institucional, enquanto o card lateral preserva superficie clara e texto escuro legivel.

### Espelho administrativo da clinica de 2026-07-24

- `frontend/app/clinicas/portal/espelho/page.tsx` passou a oferecer uma rota dedicada para selecionar a clinica e abrir a mesma experiencia do portal parceiro.
- `frontend/components/portal/PortalClinicaWorkspace.tsx` ganhou `mode="admin_preview"`, reutilizando a mesma interface de filtros, indicadores, fila operacional, lista e downloads da clinica.
- `backend/app/api/v1/endpoints/portal_clinic_auth.py` passou a expor:
  - `GET /api/v1/portal/admin/clinicas/{clinica_id}/espelho`
  - `POST /api/v1/portal/admin/clinicas/{clinica_id}/exames/{exame_id}/download-url`
- As rotas administrativas de espelho reaproveitam o mesmo motor de escopo e download do portal autenticado da clinica, reduzindo risco de divergencia entre visao interna e visao da unidade.
- `frontend/app/clinicas/portal/page.tsx` ganhou atalhos para abrir o espelho diretamente do painel e da lista de clinicas.

### Mascara do WhatsApp no convite administrativo de 2026-07-30

- O contato cadastrado, a digitacao e a colagem passaram a usar a mascara visual `(00) 00000-0000`.
- Entradas `85997060034`, `+55 (85) 99706-0034` e `85 99706-0034` foram validadas com a mesma exibicao `(85) 99706-0034` e payload `85997060034`.
- `npx eslint app/clinicas/portal/page.tsx --max-warnings=0`: ok.
- `npx tsc --noEmit --pretty false`: ok.
- `git diff --check`: ok.

### Regressao de timezone de 2026-07-22

- Log de producao revisado para o erro em `GET /api/v1/portal/admin/clinicas/acessos/painel`.
- Causa confirmada: comparacao entre `row.created_at` timezone-aware e `utcnow()` sem timezone em `_load_portal_download_analytics`.
- Ajuste aplicado: normalizacao para UTC sem timezone antes de calcular downloads dos ultimos 30 dias, ultimo acesso e ordenacao da linha do tempo.
- Regressao automatizada adicionada em `test_portal_overview_datetime_helpers_normalize_mixed_timezones`.

### Correcao de `Liberados hoje` de 2026-08-02

- Causa confirmada: `data_resultado` e gravada em UTC sem timezone, enquanto o painel comparava esse valor diretamente contra os limites sem timezone do dia de Fortaleza.
- Correcao aplicada: `_portal_utc_naive_bounds_for_local_day` converte o inicio e o fim do dia local para UTC antes de calcular `operational_summary.liberados_hoje`.
- Regressao automatizada: `test_clinica_exam_list_includes_operational_panel` cobre uma liberacao as 23:30 em Fortaleza, persistida como 02:30 UTC no dia seguinte.

## 4) Regressao e riscos residuais

- Risco residual 1: QA manual depende de ambiente com dados validos e `debug_code` exposto.
- Risco residual 2: a clinica ainda autentica pela unidade/cadastro, nao por usuario nominal persistente.
- Risco residual 3: o browser embutido nao conclui downloads nativos; a verificacao do arquivo segue coberta por HTTP e teste automatizado.
- Risco residual 4: WhatsApp deve ser reabilitado em uma fase posterior, depois de credenciais e webhook aprovados/configurados.
- Risco residual 5: o CSV representa o recorte filtrado localmente; para analytics historico/executivo amplo ainda sera melhor uma camada dedicada de relatorios.
- Risco residual 6: o indicador de inatividade de 30 dias depende da auditoria de download enriquecida e do ultimo login existente; eventos antigos sem esse contexto nao entram na leitura administrativa.
- Risco residual 7: a linha do tempo usa os eventos hoje disponiveis em convite, conta e auditoria de download; se no futuro houver novas etapas operacionais, elas precisarao ser auditadas para aparecer no cockpit.
- Risco residual 8: a atualizacao da logomarca em previews depende do tempo de cache do WhatsApp e de outros mensageiros, mesmo com a metadata correta no app.
- Risco residual 9: outros endpoints administrativos que cruzem datas historicas de origens diferentes devem reaproveitar a mesma normalizacao temporal para evitar nova divergencia entre SQLite local e PostgreSQL de producao.
- Risco residual 10: a validacao visual final em stage continua importante quando houver sessao autentica de clinica, porque o bug corrigido envolvia composicao de layout e rolagem na rota real.
- Risco residual 11: como o incidente dependia do ciclo de hidratacao do client-side com sessao persistida, a validacao final em stage e producao deve recarregar a pagina autenticada, nao apenas navegar uma vez apos o login.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
