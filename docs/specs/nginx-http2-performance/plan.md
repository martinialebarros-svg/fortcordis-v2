# Plano - HTTP/2 no Nginx da aplicacao

1. Criar um helper idempotente, habilitado somente por variavel explicita.
2. Exigir descoberta de exatamente um vhost habilitado para cada host declarado.
3. Testar alteracao agrupada, idempotencia, descoberta ambigua e rollback conjunto localmente com binarios simulados.
4. Integrar o helper ao deploy de stage e validar HTTP/2 externamente nos dominios e aliases de stage, app e institucional.
5. Bloqueio encontrado: stage e producao compartilham o listener TLS `:443`; a tentativa isolada em stage foi restaurada porque continuou em HTTP/1.1.
6. Tentativa anterior: a descoberta dos hosts do app mapeou um arquivo, `nginx -t` passou e a negociacao continuou HTTP/1.1; o helper restaurou o backup.
7. Preparar e disparar o inventario one-shot de stage somente-leitura: socket `:443`,
   topologia efetiva de `nginx -T` limitada a arquivo, `listen`, `server_name`
   e `http2`, mais probes ALPN dos dois hosts do app. A etapa so e executada
   com o marcador `[nginx-tls-inventory]` depois do deploy validado em `stage`.
8. Resultado do inventario: `fortcordis-app`, `fortcordis-stage`,
   `fortcordis-com-br` e `fortcordis-www` compartilham `0.0.0.0:443` e todos
   estao sem HTTP/2; os probes ALPN dos dois hosts do app retornaram HTTP/1.1.
9. Autorizacao especifica recebida para os quatro arquivos. Habilitar o helper
   em stage para `app.stage`, `app`, `fortcordis.com.br` e `fortcordis.com`,
   validar o rollback localmente e confirmar ALPN HTTP/2 externo antes de
   promover o snapshot exato para producao.
10. A tentativa `34013916876` passou em `nginx -t`, recebeu HTTP/1.1 e foi
    revertida automaticamente. Antes de repeti-la, exigir modulo HTTP/2 e
    aceitar diretivas `listen` com comentario final sem descartar o comentario.
11. A tentativa `34059287314` confirmou modulo e quatro vhosts, mas o primeiro
    probe ocorreu cerca de 0,2 segundo apos o reload. Repetir a validacao com
    cinco probes limitados, em intervalo de um segundo, antes do rollback.

## Rollback

O helper salva todos os `*.bak.http2.<timestamp>` antes de escrever qualquer arquivo. Falha no `nginx -t`, reload ou negociacao HTTP/2 restaura todos os backups e tenta recarregar a configuracao anterior.
