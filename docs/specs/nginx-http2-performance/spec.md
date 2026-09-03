# Especificacao - HTTP/2 no Nginx da aplicacao

## Requisitos funcionais

- RF-001: com `ENABLE_NGINX_HTTP2=1`, o deploy deve exigir `NGINX_HTTP2_EXPECTED_HOST` e `PUBLIC_URL`.
- RF-002: deve haver exatamente um vhost habilitado em `NGINX_HTTP2_ENABLED_ROOT`, apontando para um arquivo regular em `NGINX_HTTP2_SITE_ROOT` contendo o host esperado; zero ou mais de um interrompem o deploy sem escrita.
- RF-003: apenas linhas HTTPS `listen 443 ... ssl;` sem `http2` recebem o parametro `http2`.
- RF-004: antes da escrita, o arquivo ativo deve ser salvo com sufixo `.bak.http2.<timestamp>`.
- RF-005: `nginx -t` deve passar antes do reload. Falha restaura a configuracao anterior.
- RF-006: depois do reload, uma requisicao local com SNI para o host esperado deve negociar HTTP/2. Falha tambem restaura a configuracao anterior quando houve escrita.

## Requisitos nao funcionais

- NFR-001: execucoes repetidas nao duplicam `http2` nem modificam arquivo ja configurado.
- NFR-002: o workflow de stage confirma externamente HTTP/2 em `app.stage.fortcordis.com.br`.
- NFR-003: o workflow de producao confirma externamente HTTP/2 em `app.fortcordis.com.br`.
- NFR-004: os logs registram somente host, caminho de vhost e resultado; nunca valores de secrets.
