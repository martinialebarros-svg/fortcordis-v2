# Intent - HTTP/2 no Nginx da aplicacao

## Problema

Os hosts autenticados `app.stage.fortcordis.com.br` e `app.fortcordis.com.br` negociam HTTP/1.1, embora o host institucional ja negocie HTTP/2. Isso limita a multiplexacao de recursos da aplicacao e aumenta a competicao entre requisicoes no carregamento das rotas autenticadas.

## Objetivo

Habilitar HTTP/2 de forma controlada nos vhosts HTTPS do app, primeiro em stage e somente depois em producao, sem modificar hosts institucionais ou vhosts ambiguos.

## Escopo

- Descobrir o arquivo Nginx pelo `server_name` esperado.
- Alterar somente diretivas `listen 443 ... ssl` que ainda nao contem `http2`.
- Criar backup, validar a configuracao, recarregar Nginx e testar a negociacao HTTP/2.
- Restaurar automaticamente o backup se qualquer etapa falhar.

## Fora de escopo

- Alterar TLS, certificados, DNS, Cloudflare, cache ou regras de proxy.
- Alterar regras clinicas, financeiras, autorizacao ou payloads de API.
