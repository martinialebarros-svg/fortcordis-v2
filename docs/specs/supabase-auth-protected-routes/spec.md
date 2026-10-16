# Spec - Supabase Auth e rotas protegidas

Data: 2026-10-13
Status: contrato observado na PR #348; ativacao pendente

## Requisitos e contratos existentes

- RF-001: `AUTH_PROVIDER` aceita `local` ou `supabase`, com padrao `local`.
  O login local continua validando bcrypt e usuario ativo no banco interno.
- RF-002: `POST /api/v1/auth/login` recebe formulario OAuth2 (`username` e
  `password`). Em modo Supabase, o backend usa HTTPS e chave publishable para
  obter sessao por senha. Somente UUID vinculado a usuario interno ativo em
  `usuarios.supabase_auth_id` recebe acesso; email ou metadata nao criam vinculo.
- RF-003: a resposta mantem JWT proprio, `token_type`, ID, nome, email e papeis
  internos. O JWT Supabase-mode inclui identidade e provedor; sua validade e
  limitada pelo menor prazo entre `expires_in` e `ACCESS_TOKEN_EXPIRE_MINUTES`.
  Tokens locais ou de identidade desvinculada sao recusados nesse modo.
- RF-004: `POST /auth/refresh` existe somente em modo Supabase (404 no local),
  exige par CSRF cookie/header e refresh cookie, revalida vinculo ativo e
  rotaciona a sessao. `GET /auth/me` valida a sessao e fornece o JWT proprio no
  header `X-Fortcordis-Session` para sincronizar leitores legados.
- RF-005: `POST /auth/logout` tenta revogar a sessao atual (`scope=local`),
  limpa os quatro cookies e informa `provider_session_revoked`; indisponibilidade
  pode resultar em `false`. Nao ha revogacao instantanea de JWT proprio copiado.
- RF-006: middleware protege os prefixos em `dashboard-shell-routes.ts`,
  incluindo suas subrotas; `/agenda/formalizar` e subrotas sao excecoes publicas.
  Portais e links publicos mantem seu fluxo. No host institucional, as rotas
  do app redirecionam para o host do aplicativo.
- RF-007: sem cookies de sessao/refresh, redireciona ao login com `next`.
  Com cookies, consulta `/auth/me`; 401 com refresh cookie tenta renovacao.
  Negacoes de credenciais redirecionam, falhas de infraestrutura retornam 503.
  Cookies renovados seguem ao navegador e a requisicao de servidor. `next`
  aceita somente destinos internos reconhecidos, com fallback `/dashboard`.
- RF-008: Axios compartilha renovacao em voo apos 401 e repete a requisicao no
  maximo uma vez. Erro transitorio do refresh preserva armazenamento local;
  rejeicao definitiva limpa token/user e volta ao login.

## Seguranca e compatibilidade

- NFR-001: cookies `fortcordis_session`, `fortcordis_supabase_access` e
  `fortcordis_supabase_refresh` sao HttpOnly; CSRF e legivel pelo cliente.
  Secure e obrigatorio em stage/producao ou quando configurado/HTTPS.
  Tokens originais do provedor nao constam no corpo da resposta. JWT proprio
  permanece no localStorage dos fluxos legados; isso nao equivale a sessao
  Supabase acessivel por JavaScript.
- NFR-002: login, sessao e resposta de rota protegida usam `private, no-store`;
  validacao no middleware tem timeout de 12 segundos por chamada e destino
  fixo em `API_BACKEND_URL` (padrao `http://127.0.0.1:8000`).
- NFR-003: papeis, atividade e matriz interna continuam autoritativos. Esta
  integracao nao concede grants de Data API nem altera RLS.

## Banco e rollout

A migracao existente `20261012_97_supabase_auth_identity.py` adiciona coluna
opcional `supabase_auth_id` e indice unico em `usuarios`, com verificacao de
existencia para reexecucao. Nao altera senhas ou cria contas. A correcao SDD
nao aplica essa migracao a banco remoto. Instrucoes de ativacao futura estao
em [docs/supabase-auth.md](../../supabase-auth.md); nao foram executadas aqui.
Restaurar `AUTH_PROVIDER=local` retorna ao provedor anterior, mantendo a
validacao de rotas por `/auth/me`; nao equivale a revogar todos os JWTs emitidos.

## Criterios de aceitacao

- CA-001: padrao local e provedor opcional documentados conforme configuracao.
- CA-002: testes controlados de login, vinculo ativo, JWT, cookies, refresh,
  CSRF, logout e erros do provedor passam.
- CA-003: testes de rotas, destino seguro e renovacao Axios passam.
- CA-004: migracao idempotente/unica em SQLite e suite Migration CI passam.
- CA-005: tipos e suites frontend passam; SDD Guardrail aceita o diff da PR
  com os quatro artefatos e `spec.md` + `verify.md` no mesmo diretorio.
- CA-006: login real, renovacao e logout em navegador com conta vinculada,
  negacao de conta sem vinculo e permissoes de usuario nao admin sao validados
  no ambiente alvo antes de ativacao. Pendente, fora desta correcao documental.

## Casos de borda e limites

Cookie forjado nao autoriza. Usuario inativo/sem vinculo e negado. Novos modulos
precisam entrar na lista protegida. Contas criadas diretamente no provedor nao
recebem acesso interno sem vinculo. Testes simulados nao comprovam integracao
real nem isolamento de ambientes. Cadastro publico, convites, recuperacao de
senha, SMTP, politicas RLS e mudancas funcionais estao fora do escopo.
