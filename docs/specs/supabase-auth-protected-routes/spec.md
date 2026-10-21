# Contrato

## Isolamento do deploy stage

Redirecionamentos de login usam Location relativo, preservando a origem HTTPS
publica mesmo quando Next recebe URL interna localhost pelo proxy. O parametro
next preserva caminho/query e continua restrito a rotas privadas na tela de login.

O wrapper stage desabilita configuracao HTTP/2 e reload do Nginx compartilhado,
inclusive no rollback. Usa diretorio de backups exclusivo de stage para que a
retencao nao remova backups de producao. O deploy generico preserva o default de
reload para seus demais chamadores; esta entrega nao publica em producao.

## Evidencia inicial

Em 20/10/2026, consultas agregadas read-only no projeto wycxoueogfxdhyouhfhw
encontraram 4 usuarios locais ativos, todos com bcrypt, e 0 identidades em
auth.users. GET /auth/v1/settings confirmou email habilitado, confirmacao
obrigatoria e cadastro publico habilitado (disable_signup=false). Nenhuma
identidade foi criada e nenhuma configuracao do projeto foi alterada.

O checkout original estava destacado em 643f3e45 (01/10/2026), com alteracoes
locais de outro trabalho. A implementacao final usa a main atualizada ac054398
(19/10/2026); preserva os controles de Maps e o monitor de performance existentes.

Para a homologacao autorizada, a feature foi transportada para origin/stage
5478b143 (19/10/2026), preservando tambem retryMapsActionWithConsent e o rollout
cache-first do Maps, alem das mudancas clinicas que ja estavam nessa branch.
O exemplo SUPABASE_URL usa placeholder para evitar que stage herde o projeto
de producao por copia de configuracao.

## Autenticacao e autorizacao

- AUTH_PROVIDER aceita legacy ou supabase; default legacy para rollout explicito.
- Em modo supabase, login usa POST /auth/v1/token?grant_type=password. Cada
  verificacao de usuario usa GET /auth/v1/user com o token real, inclusive em
  WebSocket. Nenhuma falha autentica por senha/token legado nesse modo.
- A identidade requer UUID valido, email confirmado, ausencia de anonimato e
  app_metadata.fortcordis_user_id inteiro positivo. Esse ID e o email confirmado
  devem corresponder a usuarios; ativo=1 e obrigatorio. user_metadata e papeis
  presentes em JWT nao concedem permissoes. A matriz continua no banco local.
- O cookie HttpOnly fortcordis_session guarda o access token; fortcordis_refresh
  guarda o refresh token em cookie HttpOnly. Flags Secure/SameSite/domain/path
  seguem o contrato existente. Cookies persistem por no maximo 30 dias por
  emissao, respeitando tambem o limite/revogacao da sessao no Supabase.
- Refresh token nunca aparece em respostas JSON, logs ou localStorage.
  O access token continua em localStorage por compatibilidade com consumidores
  bearer existentes (incluindo WhatsApp); sua remocao total exige migracao propria.
- POST /api/v1/auth/refresh renova ambos os tokens. GET /auth/session fornece o
  usuario validado e access token para sincronizar consumidores legados.
- O cliente compartilha uma renovacao concorrente, renova antes da expiracao e
  verifica ao retomar o foco. Axios repete uma chamada autenticada no maximo uma
  vez apos refresh. Cookies atualizados prevalecem sobre bearer antigo no browser
  em modo supabase; consumidores sem cookie continuam usando bearer.
- Logout revoga a sessao corrente no Auth antes de limpar cookies. Com access
  token expirado/ausente, usa refresh para revogar. Falhas de rede sao informadas;
  a interface nao anuncia logout bem-sucedido quando a revogacao falha.
- Refresh e logout mantem a protecao CSRF existente, inclusive quando so existe
  o refresh cookie. Todas as respostas /api/v1/auth/ sao private,no-store.
- Administracao de usuarios continua restrita a admin: novas contas sao criadas
  com vinculo no Supabase; alteracoes de email/senha sincronizam a identidade.
  Desativacao e papeis continuam locais e sao verificados a cada requisicao.

## Rotas

Agenda, assistente-ia, atendimento, clinicas, configuracoes, dashboard, financeiro,
fiscal, laudos, logistica, pacientes, referencias-eco, relatorios, servicos,
ultrassonografia-abdominal, visualizador-vivid-iq e whatsapp-stage, incluindo
descendentes, exigem validacao de sessao no middleware Next.js.

Sem credencial: redirecionar para /?next=<rota>. Com token invalido: tentar refresh
quando disponivel, depois exigir login. Conta inativa: 403. Indisponibilidade:
503 com Retry-After, preservando cookies e sem renderizar conteudo privado.
Rotacao de cookies e encaminhada ao browser e a requisicao em andamento.
next aceita apenas destinos internos protegidos; URLs externas sao rejeitadas.

Permanecem publicos a pagina inicial, termos/privacidade/exclusao, os portais de
tutor/clinica/veterinario, /laudo/<token> e /agenda/formalizar/<token>. Seus
contratos de autenticacao proprios continuam obrigatorios nas APIs correspondentes.
O redirecionamento de host institucional para app precede a verificacao de sessao.

## Dados e falha segura

Sem mudanca de schema, grants, RLS, laudos, prontuarios ou dados financeiros.
As tabelas public continuam sem acesso direto pelo frontend; nao se criam politicas
TO authenticated genericas. O advisor reportou 60 avisos informativos de RLS sem
policy, compativeis com a arquitetura backend-only, sem alertas WARN/ERROR nessa
consulta. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

A consulta direta de grants confirmou 0 tabelas public acessiveis para anon e
authenticated. Encontrou tambem 76 tabelas public sem RLS; como nao possuem esses
grants, a ativacao do login nao lhes concede acesso direto. Esse estado anterior
nao foi alterado; antes de futuramente conceder acesso Data API a qualquer uma,
habilitar RLS e politicas especificas na mesma mudanca.

A API Auth usa apenas URL HTTPS configurada, timeout limitado e nao segue
redirecionamentos. A chave administrativa fica exclusivamente no servidor.

As transacoes SQL e a administracao Auth nao sao atomicas entre servicos. Uma
falha de commit apos sucesso no Auth pode exigir reconciliacao administrativa;
o vinculo/email inconsistente bloqueia login, sem promover acesso por email.
Nao repetir criacao/importacao indiscriminadamente nem excluir contas para
resolver divergencias. A importacao valida todos os conflitos antes de escrever,
e uma execucao parcial e retomavel; nunca sobrescreve identidades existentes.

Para liberar a homologacao stage, o lockfile do servico WhatsApp usa
follow-redirects 1.16.1. A versao 1.16.0 foi bloqueada no npm audit pelos avisos
GHSA-q3jh-wrc6-jgq8 e GHSA-8r9p-f939-6h3c. A atualizacao e transitiva e nao muda
fluxos de mensagens, configuracao Meta ou destinos de producao.
