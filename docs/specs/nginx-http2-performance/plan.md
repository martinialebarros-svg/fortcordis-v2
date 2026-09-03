# Plano - HTTP/2 no Nginx da aplicacao

1. Criar um helper idempotente, habilitado somente por variavel explicita.
2. Exigir descoberta de exatamente um vhost pelo host esperado.
3. Testar alteracao, idempotencia, descoberta ambigua e rollback localmente com binarios simulados.
4. Integrar o helper ao deploy de stage e validar HTTP/2 externamente no host `app.stage`.
5. Promover o mesmo snapshot somente apos smoke autenticado de stage e validar `app` em producao.

## Rollback

O helper salva `*.bak.http2.<timestamp>` antes de escrever. Falha no `nginx -t`, reload ou negociacao HTTP/2 restaura esse backup e tenta recarregar a configuracao anterior.
