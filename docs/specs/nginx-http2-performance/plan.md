# Plano - HTTP/2 no Nginx da aplicacao

1. Criar um helper idempotente, habilitado somente por variavel explicita.
2. Exigir descoberta de exatamente um vhost pelo host esperado.
3. Testar alteracao, idempotencia, descoberta ambigua e rollback localmente com binarios simulados.
4. Integrar o helper ao deploy de stage e validar HTTP/2 externamente no host `app.stage`.
5. Bloqueio encontrado: stage e producao compartilham o listener TLS `:443`; a tentativa isolada em stage foi restaurada porque continuou em HTTP/1.1.
6. Somente com autorizacao explicita, evoluir o helper para inventariar e atualizar atomicamente todos os vhosts que compartilham o listener, validar `nginx -t`, recarregar e testar os dois hosts.

## Rollback

O helper salva `*.bak.http2.<timestamp>` antes de escrever. Falha no `nginx -t`, reload ou negociacao HTTP/2 restaura esse backup e tenta recarregar a configuracao anterior.
