# Intent - HTTP/2 no Nginx da aplicacao

## Problema

Os hosts autenticados `app.stage.fortcordis.com.br` e `app.fortcordis.com.br`
negociam HTTP/1.1. O inventario ativo de 2026-09-03 tambem encontrou HTTP/1.1
nos vhosts institucionais que compartilham o mesmo socket TLS. Isso limita a
multiplexacao de recursos da aplicacao e aumenta a competicao entre requisicoes
no carregamento das rotas autenticadas.

## Objetivo

Habilitar HTTP/2 de forma controlada nos vhosts HTTPS do app que compartilham o listener TLS, sem modificar hosts institucionais ou vhosts ambiguos. A autorizacao explicita para a operacao atomica de stage e producao foi recebida neste ciclo.

## Escopo

- Descobrir o arquivo Nginx pelo `server_name` esperado.
- Inventariar em modo somente-leitura todos os listeners TLS e vhosts ativos
  antes de incluir qualquer host adicional no conjunto atomico.
- Alterar somente diretivas `listen 443 ... ssl` que ainda nao contem `http2`.
- Criar backup, validar a configuracao, recarregar Nginx e testar a negociacao HTTP/2.
- Restaurar automaticamente o backup se qualquer etapa falhar.

## Bloqueio confirmado em stage

Em 2026-09-03, a alteracao isolada de `fortcordis-stage` passou em
`nginx -t`, mas a conexao local continuou em HTTP/1.1; o helper restaurou o
backup. Os hosts de stage e producao compartilham a mesma VPS e listener TLS
na porta 443. A proxima tentativa deve tratar o conjunto de vhosts como uma
mudanca atomica de producao, mediante autorizacao explicita.

Na tentativa atomica autorizada, a negociacao continuou em HTTP/1.1 mesmo apos
`nginx -t`; a rotina restaurou o backup e o deploy reverteu stage. O inventario
somente-leitura posterior encontrou quatro vhosts ativos no socket
`0.0.0.0:443`: `fortcordis-app`, `fortcordis-stage`, `fortcordis-com-br` e
`fortcordis-www`. Todos estao sem HTTP/2; os dois ultimos sao institucionais e
nao pertencem a autorizacao anterior. Logo, nao pode haver nova escrita antes
de uma decisao explicita sobre o conjunto completo.

## Fora de escopo

- Alterar TLS, certificados, DNS, Cloudflare, cache ou regras de proxy.
- Alterar regras clinicas, financeiras, autorizacao ou payloads de API.
