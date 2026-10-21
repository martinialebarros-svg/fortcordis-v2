# Verificacao

Smoke do build Next real com Host app.stage e URL interna localhost encontrou
redirecionamento para localhost antes do deploy. A tentativa 39523484593 foi
cancelada antes de publicar; o ajuste usa a origem publica validada e acrescenta
regressao com essa combinacao de URL/Host e query string e rejeicao de hosts
externos/malformados. O build real deve confirmar o destino HTTPS correto.

`npm run test:auth-proxy-smoke` inicia o build Next em loopback e valida 10
casos HTTP sem credenciais: dominios publicos simulados pelo Host do proxy,
query/RSC, dominio institucional, host externo, caminho codificado e portal.
O gate de deploy stage executa esse smoke apos o build, antes de publicar.

Isolamento de release: test_stage_auth_release_isolation.py executa o wrapper com
flags herdadas de producao e comandos de servico inertes. Confere os destinos
stage, backups separados e ausencia de chamadas ao Nginx quando desabilitado;
o caminho habilitado continua validando/recarregando o servico.

Implementacao local, sem deploy e sem importacao de contas reais.
Os testes de autenticacao usam usuarios sinteticos, SQLite em memoria e respostas
Auth simuladas; nao provam um login real no projeto de producao.

## Comandos

Backend (DATABASE_URL=sqlite:// e SECRET_KEY sintetico):

```sh
python -m pytest tests/test_supabase_auth.py tests/test_websocket_auth.py tests/test_csrf_protection.py tests/test_admin_hardening_readiness.py tests/test_permission_matrix_sync.py tests/test_configuracoes_autorizacao.py tests/test_portal_clinic_invite_auth.py tests/test_portal_partner_auth.py tests/test_atendimento_pdf_auth.py tests/test_frases_ecocardiograma_estruturado_auth.py -q
```

Frontend:

```sh
npx vitest run lib/auth-session.test.ts lib/server-route-auth.test.ts lib/dashboard-shell-routes.test.ts lib/axios.test.ts
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Cobertura: login Supabase sem fallback, cookies, nao exposicao de refresh,
vinculo administrativo, email confirmado, usuario inativo, matriz de permissoes,
revogacao, renovacao, logout, timeout, rollback legado e importacao bcrypt.
Middleware: todas as familias internas, fluxos publicos, redirecionamento seguro,
rotacao de cookies, falha fechada e dominios institucionais. Cliente: refresh
concorrente unico, reidratacao, CSRF e preservacao da sessao durante falha externa.

Resultados finais e limitacoes operacionais: ver runbook.md e pacote de entrega.

## Resultados observados em 20/10/2026

- Suite completa unittest do backend: 2020 testes, OK, 69 pulados (inclui casos dependentes de PostgreSQL).
- Suite completa frontend: 109 arquivos/995 testes Vitest e 23 testes Node, todos passaram.
- Typecheck explicito, lint, build Next.js e git diff --check: passaram.
- Guardrail SDD pela funcao evaluate_guardrail, incluindo arquivos ainda nao rastreados: aprovado.
- Smoke HTTP com o build Next.js real e upstream Auth sintetico: 10 casos passaram;
  incluiu cookie forjado, sessao valida, indisponibilidade, tres fluxos publicos e
  refresh com propagacao de tres cookies. Nenhum acesso autenticado real foi feito.
- Apos os ultimos ajustes, suite especifica test_supabase_auth.py: 20 testes passaram.
- Leituras read-only de producao: email Auth habilitado; 4 contas locais bcrypt;
  0 identidades Auth; anon/authenticated sem grants em tabelas public.

A execucao completa antecedeu os ultimos casos adicionais de logout/importacao/
administracao; esses casos e os ajustes correspondentes foram revalidados na
suite focada. A homologacao com Supabase Auth real e contas sinteticas em stage
e a ativacao de producao continuam pendentes.

## Preflight da homologacao autorizada

- Base remota e runtime stage: 5478b14387e113ea97ea1bfbfa6190139a4ecdbd.
- APP_ENV=stage; banco stage usa o projeto dtguubpzjrkvqjryazjq e difere de producao.
- Runtime stage ainda usa login legacy e nao configura SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY nem SUPABASE_SECRET_KEY.
- A conexao Supabase lista apenas fortcordis-prod e nega acesso ao projeto stage
  com erro de permissao. Nenhuma conta sintetica pode ser criada por essa conexao.
- Acesso/configuracao segura do projeto stage solicitado ao usuario; nenhum
  segredo foi solicitado no chat e nenhum projeto pago foi criado.
- Nenhuma mudanca de runtime stage, servico compartilhado, banco ou producao foi
  feita durante esse preflight. O deploy stage padrao recarrega Nginx e verifica
  listeners compartilhados com producao; esse efeito deve ser evitado na
  homologacao limitada a stage antes de executar o rollout.

O resultado de verificacoes locais/CI desta branch nao substitui autenticacao
Supabase real em stage. A homologacao permanece bloqueada ate configurar o
projeto e as chaves de Auth do ambiente de stage.

Validacao sobre a base stage: 60 testes backend/Auth/Maps passaram, 5 casos
PostgreSQL foram pulados. Typecheck e lint passaram. A suite frontend completa
teve uma falha de sincronizacao no teste preexistente de hidratacao do tutor em
NovoAgendamentoModal (1077 passaram); o arquivo usa mock completo de axios e nao
foi alterado pela feature. A reexecucao focada desse arquivo junto dos testes
Auth passou (14 testes). Esse resultado deve ser conferido novamente no CI; nao
foi alterado codigo de Agenda para contornar a falha.

O primeiro gate de deploy stage (run 39522210663) passou backend, PostgreSQL,
lint, build frontend e testes funcionais WhatsApp; parou no npm audit da versao
1.16.0 de follow-redirects. O deploy foi pulado. A correcao atualiza somente essa
entrada transitiva para 1.16.1 e exige auditoria sem achados, build e testes de
Auth, HTTP Express e retries antes de repetir o gate completo.

Validacao local da correcao: npm audit --omit=dev encontrou 0 vulnerabilidades;
build TypeScript e testes auth-policy, express-http e whatsapp-retry passaram.
Achados nas dependencias de desenvolvimento nao foram incluidos nesta correcao.
