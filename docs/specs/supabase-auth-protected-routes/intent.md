# Intent - Supabase Auth e rotas protegidas

Data: 2026-10-13
Status: documentacao retrospectiva da PR #348; ativacao pendente

## Problema e objetivo

A PR #348 implementa um provedor opcional de autenticacao e protecao das rotas
internas antes da renderizacao, mas seu diff nao continha os artefatos SDD.
Esta correcao documenta o comportamento existente no commit
`6e451e4da981d443ba0e33cc0abae805cb4c3684` e registra evidencias verificaveis.
Nao representa uma aprovacao retroativa de rollout ou uma validacao operacional.

## Escopo e restricoes

- Autenticacao da equipe via FastAPI, renovacao, logout e middleware Next.js.
- `AUTH_PROVIDER=local` permanece o padrao. Supabase e opcional e requer
  configuracao explicita e vinculo administrativo de identidade.
- Esta iteracao altera somente os quatro documentos desta feature; publica
  na branch da mesma PR, mantendo draft, e acompanha seus checks.
- Fora de escopo: mudanca funcional, merge, deploy, aplicacao de migracao em
  ambiente remoto, contas, permissoes, RLS e ativacao de Supabase Auth.

## Riscos e dependencias

A protecao depende do backend acessivel e da lista de modulos internos.
A ativacao futura depende de ambiente definido, migracao e contas vinculadas.
Respostas simuladas nao comprovam login real, SMTP, renovacao no navegador ou
revogacao operacional. JWTs copiados podem durar ate a expiracao.

## Definition of Ready desta correcao

- [x] Objetivo restrito a documentacao e validacao.
- [x] Autorizacao para commit e push na PR existente recebida em 13/10/2026.
- [x] Contratos, riscos e pendencias identificados por leitura do codigo.
- [x] Trabalho local de outras tarefas preservado em checkout isolado.

Referencias: [spec.md](spec.md), [plan.md](plan.md), [verify.md](verify.md) e
[guia operacional existente](../../supabase-auth.md).
