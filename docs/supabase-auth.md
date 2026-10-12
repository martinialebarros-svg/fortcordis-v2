# Supabase Auth e rotas protegidas

O login da equipe pode usar Supabase Auth sem substituir as permissoes do
Fort Cordis. O frontend continua chamando o FastAPI em `/api/v1/auth/login`.
O backend envia email e senha ao Supabase por HTTPS, recebe a sessao e busca
o usuario interno pelo UUID em `usuarios.supabase_auth_id`. Nao existe
associacao automatica por email, `user_metadata` ou papel informado pelo cliente.

O backend emite um JWT proprio para manter APIs, WebSockets e o backend
WhatsApp compativeis. Esse JWT expira no menor prazo entre a sessao Supabase
e `ACCESS_TOKEN_EXPIRE_MINUTES`. Papeis, usuario ativo e a matriz de permissoes
continuam sendo consultados no banco pelo FastAPI. Quando `AUTH_PROVIDER=supabase`,
JWTs locais antigos e tokens de identidades desvinculadas sao recusados.

## Sessao e protecao

- JWT da aplicacao: cookie `fortcordis_session`, HttpOnly, Secure em stage/producao.
- Tokens originais Supabase: cookies `fortcordis_supabase_access` e
  `fortcordis_supabase_refresh`, ambos HttpOnly; nunca retornados no corpo ou
  expostos como variaveis `NEXT_PUBLIC_*`.
- O JWT local ainda e retornado para os fluxos legados que usam Bearer no
  WhatsApp. O login ja armazenava esse JWT em localStorage; ele nao permite
  acessar diretamente a Data API do Supabase. O refresh token fica fora do JS.
  `/auth/me` devolve o JWT local validado no header `X-Fortcordis-Session`,
  sincronizado pelo Axios apos renovacao no middleware, para que os leitores
  legados de localStorage nao continuem enviando um Bearer expirado.
- `/auth/refresh` exige o par cookie/header CSRF mesmo quando o cookie de
  acesso ja expirou. Renova tokens no Supabase, revalida vinculo e usuario ativo
  e reemite o JWT. O cliente Axios compartilha uma renovacao em voo e repete
  a requisicao no maximo uma vez; erros transitorios nao apagam a sessao.
- O middleware Next.js valida `/auth/me` antes de renderizar os modulos internos.
  Em expiracao, renova pelo backend e encaminha cookies novos tanto ao navegador
  quanto a requisicao do servidor. Cookies presentes, por si so, nao autorizam.
  Erro de infraestrutura retorna 503; credenciais invalidas voltam ao login.
- Login e paginas internas usam `Cache-Control: private, no-store`.
- O destino `next` aceita somente rotas internas, com bloqueio de open redirect.
- Portais de tutores/clinicas e links publicos continuam com sua autenticacao
  propria. Apenas os modulos da equipe listados em `dashboard-shell-routes.ts`
  entram nesta protecao; novos modulos precisam ser adicionados nessa lista.
- Logout revoga a sessao atual no Supabase e apaga os quatro cookies. Se o
  Supabase estiver indisponivel, a limpeza local ocorre e a resposta informa
  `provider_session_revoked=false`. JWTs de acesso previamente copiados continuam
  validos ate expirar, como no modelo anterior; nao ha revogacao instantanea por JWT.

## Ativacao em homologacao

1. Identifique o projeto Supabase do ambiente. Nao aponte homologacao para
   producao sem uma decisao explicita sobre isolamento.
2. Aplique as migracoes com o runner existente do repositorio. A migracao
   `20261012_97` adiciona o vinculo opcional e exclusivo em `usuarios`; nao
   altera senhas, papeis, contas ou dados existentes. O runner e a fonte de
   historico deste app, portanto nao ha migracao paralela no CLI Supabase.
3. Cadastre as contas da equipe em Supabase Auth pelo painel. Defina o fluxo
   de confirmacao/recuperacao e SMTP desse ambiente. Esta implementacao nao
   abre cadastro publico nem envia convites automaticamente.
4. Vincule cada UUID autenticado ao ID interno verificado, com acesso
   administrativo ao banco. Exemplo parametrizado (substitua ambos os parametros
   por valores conferidos no painel e no cadastro interno):

   ```sql
   UPDATE usuarios
   SET supabase_auth_id = :supabase_uuid
   WHERE id = :usuario_id AND supabase_auth_id IS NULL;
   ```

   Confira que foi alterada exatamente uma linha. Um UUID nao pode ser usado
   por dois usuarios. Sem vinculo, uma conta Supabase nao tem acesso ao app.
5. Configure **somente o backend**, com a chave publishable do mesmo projeto:

   ```dotenv
   AUTH_PROVIDER=supabase
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   AUTH_COOKIE_SECURE=true
   ```

   Nao use `service_role`/secret key para login. A URL e chave nao sao incluidas
   nesta alteracao, pois o projeto de homologacao ainda precisa ser identificado.
6. No frontend, configure `API_BACKEND_URL` com o endereco interno correto
   daquele ambiente. Se personalizar nomes de cookies/CSRF no backend, replique
   `AUTH_COOKIE_NAME`, `SUPABASE_REFRESH_COOKIE_NAME`, `CSRF_COOKIE_NAME` e
   `CSRF_HEADER_NAME` no frontend (variaveis de servidor). O Axios existente
   usa o nome padrao `fortcordis_csrf`/`x-csrf-token` no navegador.
7. Valide login com uma conta vinculada, negacao para conta sem vinculo,
   acesso a uma rota interna sem login, renovacao, logout e permissoes de um
   usuario sem papel admin. Para voltar ao login anterior, restaure
   `AUTH_PROVIDER=local`; o middleware de protecao continua validando `/auth/me`.

## Banco e verificacao

A integracao usa o FastAPI para dados e nao concede novos acessos `anon` ou
`authenticated` nem altera RLS. Rotas protegidas nao substituem politicas RLS
se um cliente passar a acessar diretamente a Data API no futuro.

Na inspecao de 12/10/2026, o plugin apresentou apenas `fortcordis-prod`
(`wycxoueogfxdhyouhfhw`), com **zero contas em `auth.users`**. Nenhuma alteracao
foi aplicada ao banco remoto e nenhuma conta foi criada. O advisor apontou
53 tabelas com RLS ativo e sem politicas, um aviso informativo consistente
com uso exclusivo via backend; nao foram criadas politicas de acesso amplo.
Uma leitura de `/auth/v1/settings` com a chave publishable retornou HTTP 200
e confirmou o provedor email habilitado. O projeto permite signup no provedor;
a ausencia de cadastro na interface nao desativa essa API. Contas cadastradas
diretamente continuam sem acesso ao Fort Cordis ate receberem vinculo administrativo.

Testes adicionados cobrem login e refresh, vinculos invalidos/inativos,
limite de validade do JWT, cookies HttpOnly, CSRF, logout, erros do provedor,
migracao idempotente com unicidade e middleware com falha fechada.
Login real de ponta a ponta depende de contas vinculadas e configuracao do
ambiente; os testes automatizados usam respostas controladas do provedor.

Referencias oficiais consultadas:
- [Supabase Auth OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml)
- [Autenticacao por senha](https://supabase.com/docs/guides/auth/passwords)
- [Seguranca das sessoes](https://supabase.com/docs/guides/auth/sessions)
- [Advisor de RLS sem politicas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
