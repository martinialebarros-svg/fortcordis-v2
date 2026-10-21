# Ativacao controlada

O codigo esta separado do checkout original; nenhuma mudanca remota foi feita.
Nao executar estas etapas em producao sem autorizar a publicacao desse ambiente.

## Configuracao

Backend: preencher SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY com o projeto do
ambiente. Para fortcordis-prod, URL https://wycxoueogfxdhyouhfhw.supabase.co.
SUPABASE_SECRET_KEY deve ser obtida no gerenciador seguro do servidor; nao
enviar pelo chat, incluir em bundle ou usar prefixo NEXT_PUBLIC_. Ela permite a
importacao e a administracao de contas pela API. Nao e usada para login/validacao.
Manter AUTH_PROVIDER=legacy durante a preparacao.

Frontend: API_BACKEND_URL deve apontar para o upstream interno correto em tempo
de build/runtime. Nomes de cookie/CSRF devem coincidir com o backend. O cliente
browser mantem os nomes padrao fortcordis_csrf/x-csrf-token do sistema atual.
Se forem customizados, adaptar tambem auth-session.ts e axios.ts antes de publicar.
Usar HTTPS e cookies Secure em stage/producao. Evitar dominio de cookie que
compartilhe sessao entre stage e producao.

## Preparacao e homologacao

O deploy stage nao reconfigura nem recarrega Nginx compartilhado e guarda backups
em ~/fortcordis-stage-runtime-backups. Publicar com AUTH_PROVIDER=legacy para o
canario atual, que gera JWT legado. A homologacao sintetica pode ativar Supabase
temporariamente; retornar a legacy apos limpar fixtures preserva o acesso da
equipe ainda nao importada. Ativacao permanente exige importar contas autorizadas
e usar o canario interno compativel com Supabase, sem desabilitar checks.
Esse canario usa uma identidade administrativa ja vinculada, emite sessao sem
enviar email e revoga somente a propria sessao ao terminar; nao cria conta extra.

1. Usar projeto/ambiente de stage separado e contas sinteticas; manter chaves,
   dados e cookies de producao fora da homologacao.
2. Configurar no Dashboard Auth o acesso da equipe como administrado, desabilitando
   cadastro publico. Na leitura de producao em 20/10, disable_signup estava false.
   Contas sem app_metadata administrativo nao entram no aplicativo mesmo assim.
   A ferramenta Supabase conectada nao oferece alteracao das configuracoes Auth;
   essa etapa exige Dashboard ou Management API autorizada no release.
3. Conferir Site URL e URLs permitidas do ambiente. Este fluxo usa senha via
   backend; nao usa callbacks OAuth nem modifica templates de email.
4. No backend do ambiente, executar primeiro `python scripts/import_supabase_auth_users.py`.
   O dry-run consulta identidades, valida hashes e conflitos, e imprime somente
   contagens. Exige chave administrativa mesmo sem --apply.
5. Apos revisar o resultado, executar o mesmo comando com --apply no ambiente
   autorizado. Preserva bcrypt e vincula IDs via app_metadata. Nao envia email,
   nao muda senhas, nao altera usuarios locais, papeis ou dados clinicos.
   Identidades existentes inconsistentes bloqueiam o processo; nao sao sobrescritas.
6. Verificar todas as contas vinculadas antes de mudar AUTH_PROVIDER=supabase.
   Publicar frontend/backend juntos para disponibilizar /auth/session e /auth/refresh.
7. Validar login, reload, expiracao/refresh, outra aba, retorno ao foco, logout,
   acesso direto a pagina interna, conta sem permissao/inativa, API bearer,
   WebSocket e modulo WhatsApp usando apenas dados sinteticos. Nao enviar mensagens.
8. Verificar que portais e links por token continuam acessiveis, que cookies
   renovados nao sao cacheados por CDN/proxy e que retornar a uma pagina privada
   depois do logout exige autenticacao.

## Producao e rollback

Somente apos homologacao e autorizacao do release, repetir a preparacao para as
4 contas reais. Nao usar o projeto fortcordis-prod para testes de escrita.
O login real com credenciais da equipe nao foi executado nesta entrega.

Rollback explicito: voltar AUTH_PROVIDER=legacy, reiniciar backend e exigir novo
login. Tokens Supabase sao recusados no modo legado. Os hashes originais foram
preservados; senhas alteradas diretamente no Supabase depois da ativacao podem
divergir do hash local e exigem reconciliacao segura. Nao apagar auth.users.

Falhas parciais em criar/alterar contas entre Auth e SQL exigem reconciliacao:
verificar ID vinculado, email e estado de ambas as contas antes de repetir.
Nao ha transacao distribuida e nao ha exclusao automatica de identidades.

Documentacao consultada:

- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://github.com/supabase/auth/blob/master/internal/api/admin.go
- https://github.com/supabase/auth/blob/master/internal/api/auth.go
- https://supabase.com/docs/guides/auth/signout
- https://supabase.com/changelog/cbc-tls-ciphers-deprecated
