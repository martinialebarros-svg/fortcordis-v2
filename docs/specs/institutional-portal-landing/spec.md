# Spec - institutional-portal-landing

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Escopo funcional

Criar a experiencia institucional inicial da Fort Cordis no frontend Next.js. A entrega inclui uma home para hosts institucionais, paginas de entrada para tutor e clinica parceira, copy com dicas de saude pet e a recomendacao de acesso seguro a exames baseada em LGPD. O login administrativo permanece preservado nos hosts do app.

## 2) Requisitos funcionais (RF)

- RF-001: em host institucional, `/` deve exibir a landing page da Fort Cordis.
- RF-002: em host nao institucional, `/` deve continuar exibindo `LoginPageClient`.
- RF-003: a landing page deve direcionar para portal do tutor, portal da clinica parceira e sistema administrativo.
- RF-004: a landing page deve incluir dicas para tutores sobre preparacao, sinais de alerta, rotina e resultados.
- RF-005: a landing page deve explicar a proposta de acesso seguro para tutores e clinicas parceiras.
- RF-006: `/area-pacientes` deve substituir o placeholder por uma pagina de entrada para tutores.
- RF-007: `/clinica-parceira` deve substituir o placeholder por uma pagina de entrada para clinicas parceiras.
- RF-008: as paginas publicas nao devem implementar download fake, token estatico ou exposicao de dado real.
- RF-009: links para secoes da mesma pagina devem usar rolagem suave e manter margem visual no destino.
- RF-010: textos publicos em portugues devem preservar acentos, cedilhas e grafia adequada.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): a orientacao de acesso a exames deve indicar autorizacao no backend, MFA/codigo temporario, escopo por tutor/pet/clinica/unidade e auditoria.
- NFR-002 (LGPD): o site deve orientar que notificacoes nao carregam anexos sensiveis e que arquivos ficam protegidos no sistema Fort Cordis.
- NFR-003 (UX/performance): o hero institucional deve usar asset local otimizado e chamadas claras para tutor e clinica.
- NFR-004 (compatibilidade): o roteamento por host existente deve ser mantido.
- NFR-005 (acessibilidade): animacoes de entrada e rolagem suave devem respeitar `prefers-reduced-motion`.

## 4) Contratos tecnicos

### API

- Endpoint: nenhum endpoint novo nesta iteracao.
- Metodo: nao aplicavel.
- Payload: nao aplicavel.
- Resposta: nao aplicavel.

Contrato implementado pela fase posterior `portal-secure-access-foundation` + `portal-access-ui`:
- `POST /api/v1/portal/tutores/sessao-link`
- `POST /api/v1/portal/clinicas/sessao-link`
- `GET /api/v1/portal/pets/{pet_id}/exames`
- `POST /api/v1/portal/exames/{exame_id}/download-url`

Regras recomendadas:
- emitir URL assinada com expiracao curta;
- nao aceitar token sensivel em query string como credencial principal;
- auditar usuario, escopo, IP, user agent, exame e finalidade;
- validar vinculo tutor/pet e clinica/unidade antes de qualquer arquivo.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas:
  - `frontend/app/page.tsx`
  - `frontend/app/area-pacientes/page.tsx`
  - `frontend/app/clinica-parceira/page.tsx`
  - `frontend/app/layout.tsx`
- Estados de UI:
  - landing institucional com hero, portais, seguranca, dicas e integracao;
  - pagina de tutor com modelo de acesso e dicas de saude pet;
  - pagina de clinica parceira com governanca e modelo de download;
  - login administrativo preservado fora de hosts institucionais.
- Regras de exibicao/erro:
  - a landing institucional permanece responsavel pela apresentacao e pelos CTAs;
  - os formularios autenticados e downloads reais pertencem ao escopo de `portal-access-ui`;
  - sem links de download simulados ou arquivos sensiveis fora do fluxo autenticado.

## 5) Compatibilidade e rollout

- Backward compatibility:
  - `/` continua login administrativo em hosts nao institucionais.
  - rotas internas do app seguem redirecionando para `app.fortcordis.com.br` quando acessadas pelos hosts institucionais `fortcordis.com`, `www.fortcordis.com`, `fortcordis.com.br` e `www.fortcordis.com.br`.
- Feature flag: nao.
- Estrategia de rollback:
  - revert dos arquivos de frontend e remocao do asset `fortcordis-portal-hero.jpg`.

## 6) Criterios de aceitacao (CA)

- CA-001: `/` com `Host: fortcordis.com`, `www.fortcordis.com`, `fortcordis.com.br` ou `www.fortcordis.com.br` renderiza landing institucional.
- CA-002: `/` em localhost/host nao institucional renderiza login administrativo.
- CA-003: a home tem CTAs para `/area-pacientes`, `/clinica-parceira` e app administrativo.
- CA-004: `/area-pacientes` nao mostra mais placeholder de construcao e descreve acesso seguro para tutores.
- CA-005: `/clinica-parceira` nao mostra mais placeholder de construcao e descreve governanca por unidade.
- CA-006: build do frontend passa sem erro.
- CA-007: verificacao visual em desktop e mobile nao mostra hero quebrado, texto sobreposto ou asset ausente.
- CA-008: navegacao por ancora e animacoes sao suaves, sem overflow, e a copy publica auditada da home, area do tutor e clinica parceira nao exibe palavras sem diacriticos necessarios.

## 7) Casos de borda

- CB-001: host institucional com rota interna de app deve continuar sendo redirecionado pelo middleware.
- CB-002: host desconhecido deve manter comportamento administrativo atual.
- CB-003: o asset hero deve carregar por caminho local sem depender de servico externo.
- CB-004: conteudo do portal nao deve induzir envio de exames por email ou WhatsApp.
- CB-005: durante o rollout preliminar email-only, a landing nao deve prometer acesso por WhatsApp antes da liberacao da API da Meta.

## 8) Fora de escopo

- Login definitivo com usuario nominal persistido para clinicas parceiras.
- Painel administrativo de convites do portal.
- Provisao de credenciais reais de email/WhatsApp/storage para producao.
- Ativacao de WhatsApp no portal antes da aprovacao da API Business pela Meta.
- Criacao de storage, signed URLs ou politica RLS.
- Deploy em producao.
