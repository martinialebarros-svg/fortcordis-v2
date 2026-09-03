# Verificacao - HTTP/2 no Nginx da aplicacao

## Validacao local prevista

```bash
bash -n scripts/ensure_nginx_http2.sh scripts/deploy_prod_vps.sh scripts/deploy_stage_vps.sh
bash scripts/tests/test_nginx_http2_enablement.sh
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD
```

## Casos cobertos

- Dois vhosts declarados: ativa HTTP/2 nas diretivas IPv4 e IPv6 dos dois arquivos.
- Segunda execucao: nao duplica diretivas nem modifica os arquivos.
- Falha de `nginx -t`: restaura os dois vhosts originais.
- Negociacao HTTP/1.1 apos o reload: restaura os dois vhosts originais.
- Mais de um vhost para qualquer host esperado: interrompe sem modificar nenhum arquivo.

## Validacao de rollout pendente

### Tentativa isolada de stage - 2026-09-03

- Quality gate, SDD e Migration CI passaram para `b95fe0db`.
- O deploy encontrou exatamente o vhost `fortcordis-stage`, criou backup, adicionou a diretiva HTTP/2 e passou em `nginx -t`.
- A requisicao local com SNI ainda negociou HTTP/1.1; o helper restaurou o backup e o rollback automatico retornou o checkout de stage a `9b6dd020`.
- Nenhuma configuracao de producao foi alterada.

### Validacao atomica autorizada

A autorizacao explicita para alterar os vhosts compartilhados de stage e producao foi recebida. O rollout deve inventariar os listeners `:443`, aplicar HTTP/2 de modo atomico, validar `nginx -t`, fazer rollback de todos os arquivos se falhar, testar os dois hosts por `curl --http2` e repetir o smoke autenticado.
