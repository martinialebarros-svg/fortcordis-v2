# Verificacao - HTTP/2 no Nginx da aplicacao

## Validacao local prevista

```bash
bash -n scripts/ensure_nginx_http2.sh scripts/deploy_prod_vps.sh scripts/deploy_stage_vps.sh
bash scripts/tests/test_nginx_http2_enablement.sh
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD
```

## Casos cobertos

- Vhost unico: ativa HTTP/2 nas diretivas IPv4 e IPv6.
- Segunda execucao: nao duplica diretivas nem modifica o arquivo.
- Falha de `nginx -t`: restaura o vhost original.
- Mais de um vhost para o host esperado: interrompe sem modificar nenhum arquivo.

## Validacao de rollout pendente

- Stage: workflow e `curl --http2` externo em `https://app.stage.fortcordis.com.br/` devem negociar HTTP/2, seguido de smoke autenticado de Dashboard, Financeiro e WhatsApp.
- Producao: somente apos stage aprovado, o mesmo snapshot deve negociar HTTP/2 em `https://app.fortcordis.com.br/`, com smoke autenticado e rota protegida respondendo 401 sem credenciais.
