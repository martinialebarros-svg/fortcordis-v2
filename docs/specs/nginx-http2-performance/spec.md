# Especificacao - HTTP/2 no Nginx da aplicacao

## Requisitos funcionais

- RF-001: com `ENABLE_NGINX_HTTP2=1`, o deploy deve exigir `NGINX_HTTP2_EXPECTED_HOSTS` com ao menos dois hosts distintos separados por virgula.
- RF-002: para cada host declarado, deve haver exatamente um vhost habilitado em `NGINX_HTTP2_ENABLED_ROOT`, apontando para um arquivo regular em `NGINX_HTTP2_SITE_ROOT` contendo o host; zero ou mais de um interrompem o deploy sem escrita.
- RF-003: apenas linhas HTTPS `listen 443 ... ssl;` sem `http2` recebem o parametro `http2`, inclusive quando possuem comentario final; o comentario deve ser preservado.
- RF-003a: antes de qualquer backup ou escrita, o helper deve confirmar que o binario Nginx contem `--with-http_v2_module`; ausencia do modulo interrompe sem modificar vhost.
- RF-004: antes de qualquer escrita, cada arquivo ativo que sera alterado deve ser salvo com sufixo `.bak.http2.<timestamp>`.
- RF-005: somente depois de todos os backups o helper pode escrever os arquivos; `nginx -t` deve passar antes do reload. Falha restaura todos os arquivos alterados.
- RF-006: depois do reload, uma requisicao local com SNI e uma requisicao pelo caminho publico para cada host declarado devem negociar HTTP/2. Cada probe tem ate cinco tentativas com um segundo de intervalo para permitir a troca de workers; falha em qualquer verificacao restaura todos os arquivos alterados quando houve escrita.
- RF-007: quando hosts de stage e producao compartilham o listener TLS `:443`, a habilitacao deve ocorrer apenas pela rotina atomica autorizada. O inventario de 2026-09-06 confirmou que `fortcordis-app`, `fortcordis-stage`, `fortcordis-com-br` e `fortcordis-www` compartilham esse listener. A autorizacao atual cobre `app.stage.fortcordis.com.br`, `app.fortcordis.com.br`, `fortcordis.com.br` e `fortcordis.com`; a descoberta deve mapear cada um a exatamente um arquivo antes de qualquer escrita.
- RF-008: o inventario one-shot de stage, acionado exclusivamente pelo marcador
  `[nginx-tls-inventory]`, deve executar apenas leitura de socket, topologia
  ativa do Nginx e probes locais descartando o corpo da resposta; nao pode
  escrever arquivos, recarregar servicos ou alterar vhosts.

## Requisitos nao funcionais

- NFR-001: execucoes repetidas nao duplicam `http2` nem modificam arquivo ja configurado.
- NFR-002: o workflow deve confirmar externamente HTTP/2 nos dominios e aliases de `app.stage.fortcordis.com.br`, `app.fortcordis.com.br`, `fortcordis.com.br` e `fortcordis.com`.
- NFR-003: nenhum workflow pode tentar habilitar HTTP/2 em apenas um vhost enquanto o listener for compartilhado.
- NFR-004: os logs registram somente host, caminho de vhost e resultado; nunca valores de secrets.
- NFR-005: a saida do inventario deve ser limitada a versao do Nginx, socket,
  caminho do arquivo, `listen`, `server_name`, diretiva `http2` e resultado
  ALPN dos hosts autorizados.
