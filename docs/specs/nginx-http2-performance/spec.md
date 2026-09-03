# Especificacao - HTTP/2 no Nginx da aplicacao

## Requisitos funcionais

- RF-001: com `ENABLE_NGINX_HTTP2=1`, o deploy deve exigir `NGINX_HTTP2_EXPECTED_HOSTS` com ao menos dois hosts distintos separados por virgula.
- RF-002: para cada host declarado, deve haver exatamente um vhost habilitado em `NGINX_HTTP2_ENABLED_ROOT`, apontando para um arquivo regular em `NGINX_HTTP2_SITE_ROOT` contendo o host; zero ou mais de um interrompem o deploy sem escrita.
- RF-003: apenas linhas HTTPS `listen 443 ... ssl;` sem `http2` recebem o parametro `http2`.
- RF-004: antes de qualquer escrita, cada arquivo ativo que sera alterado deve ser salvo com sufixo `.bak.http2.<timestamp>`.
- RF-005: somente depois de todos os backups o helper pode escrever os arquivos; `nginx -t` deve passar antes do reload. Falha restaura todos os arquivos alterados.
- RF-006: depois do reload, uma requisicao local com SNI para cada host declarado deve negociar HTTP/2. Falha tambem restaura todos os arquivos alterados quando houve escrita.
- RF-007: quando hosts de stage e producao compartilham o listener TLS `:443`, a habilitacao deve ocorrer apenas pela rotina atomica autorizada, que inventaria os dois hosts e trata seus vhosts como um unico conjunto reversivel.

## Requisitos nao funcionais

- NFR-001: execucoes repetidas nao duplicam `http2` nem modificam arquivo ja configurado.
- NFR-002: o workflow deve confirmar externamente HTTP/2 em `app.stage.fortcordis.com.br` e `app.fortcordis.com.br`.
- NFR-003: nenhum workflow pode tentar habilitar HTTP/2 em apenas um vhost enquanto o listener for compartilhado.
- NFR-004: os logs registram somente host, caminho de vhost e resultado; nunca valores de secrets.
