# Plano - HTTP/2 no Nginx da aplicacao

1. Criar um helper idempotente, habilitado somente por variavel explicita.
2. Exigir descoberta de exatamente um vhost habilitado para cada host declarado.
3. Testar alteracao agrupada, idempotencia, descoberta ambigua e rollback conjunto localmente com binarios simulados.
4. Integrar o helper ao deploy de stage e validar HTTP/2 externamente nos hosts `app.stage` e `app`.
5. Bloqueio encontrado: stage e producao compartilham o listener TLS `:443`; a tentativa isolada em stage foi restaurada porque continuou em HTTP/1.1.
6. Autorizacao explicita recebida: atualizar atomicamente os hosts do app, validar `nginx -t`, recarregar e testar os dois hosts. A descoberta os mapeou para um unico arquivo e a negociacao continuou HTTP/1.1; o helper restaurou o backup.
7. Proximo passo: inventariar somente em leitura todos os vhosts com `listen :443`. Se a correcao exigir vhost fora do app, solicitar autorizacao especifica antes de qualquer escrita.

## Rollback

O helper salva todos os `*.bak.http2.<timestamp>` antes de escrever qualquer arquivo. Falha no `nginx -t`, reload ou negociacao HTTP/2 restaura todos os backups e tenta recarregar a configuracao anterior.
