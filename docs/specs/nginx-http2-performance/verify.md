# Verificacao - HTTP/2 no Nginx da aplicacao

## Validacao local prevista

```bash
bash -n scripts/ensure_nginx_http2.sh scripts/deploy_prod_vps.sh scripts/deploy_stage_vps.sh
bash scripts/tests/test_nginx_http2_enablement.sh
bash scripts/tests/test_nginx_tls_listener_inventory.sh
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

## Casos cobertos

- Quatro vhosts declarados: ativa HTTP/2 nas diretivas IPv4 e IPv6 dos quatro arquivos.
- Segunda execucao: nao duplica diretivas nem modifica os arquivos.
- Falha de `nginx -t`: restaura os quatro vhosts originais.
- Negociacao HTTP/1.1 local ou externa apos o reload: restaura os quatro vhosts originais.
- Modulo HTTP/2 indisponivel: interrompe antes de criar backup ou escrever vhost.
- Mais de um vhost para qualquer host esperado: interrompe sem modificar nenhum arquivo.

## Validacao de rollout pendente

### Tentativa isolada de stage - 2026-09-03

- Quality gate, SDD e Migration CI passaram para `b95fe0db`.
- O deploy encontrou exatamente o vhost `fortcordis-stage`, criou backup, adicionou a diretiva HTTP/2 e passou em `nginx -t`.
- A requisicao local com SNI ainda negociou HTTP/1.1; o helper restaurou o backup e o rollback automatico retornou o checkout de stage a `9b6dd020`.
- Nenhuma configuracao de producao foi alterada.

### Tentativa atomica anterior

O rollout `1891b71d` recebeu autorizacao explicita para alterar os hosts do app. A descoberta encontrou os dois hosts no mesmo arquivo ativo; a rotina alterou um arquivo, `nginx -t` passou e a verificacao local continuou em HTTP/1.1. O backup desse arquivo foi restaurado e o deploy reverteu stage para `44e9c07`.

Antes da nova tentativa, o inventario somente-leitura deve listar todos os vhosts com `listen :443`. A autorizacao atual inclui os quatro vhosts encontrados; depois da escrita, testar os dominios e aliases por `curl --http2` e repetir o smoke autenticado.

### Inventario somente-leitura preparado

- `scripts/inventory_nginx_tls_listeners.sh` nao escreve, nao recarrega Nginx e
  limita a saida aos metadados permitidos pela especificacao.
- A etapa one-shot do deploy de `stage` exige o marcador
  `[nginx-tls-inventory]`, ocorre somente depois do deploy aprovado e transmite
  o script por stdin, sem criar artefato remoto.

### Inventario somente-leitura executado - 2026-09-03

- Workflow de stage `33755166487`, commit `8370c3c1`: concluido com sucesso;
  a etapa de inventario tambem foi concluida com sucesso.
- Nginx `1.18.0` escuta em `0.0.0.0:443`. Os vhosts ativos sao
  `fortcordis-app`, `fortcordis-stage`, `fortcordis-com-br` e
  `fortcordis-www`; todos possuem `http2=absent`.
- As probes locais com SNI retornaram `HTTP/1.1` e `200` para
  `app.stage.fortcordis.com.br` e `app.fortcordis.com.br`.
- Nenhum arquivo, certificado, listener ou servico foi alterado durante a
  coleta. A autorizacao posterior cobre a escrita atomica dos quatro vhosts.

### Preflight da nova tentativa (2026-09-06)

- O workflow de stage `34011949747` concluiu: quality gate, SDD e deploy foram
  aprovados; o canario autenticado mediu p95 de 469,89 ms (5/5), abaixo de
  1.200 ms.
- O inventario read-only confirmou `0.0.0.0:443` e os quatro arquivos
  `fortcordis-app`, `fortcordis-stage`, `fortcordis-com-br` e
  `fortcordis-www`, todos sem HTTP/2.
- Os probes ALPN de `app.stage.fortcordis.com.br` e
  `app.fortcordis.com.br` retornaram HTTP/1.1. A ativacao e o smoke externo
  completo permanecem pendentes nesta versao.

### Tentativa controlada e rollback (2026-09-06)

- O workflow de stage `34013916876` aprovou SDD e quality gate, mas o helper
  alterou temporariamente tres arquivos, passou em `nginx -t` e recebeu
  HTTP/1.1 no probe local de `app.stage.fortcordis.com.br`.
- O helper restaurou os backups; em seguida o deploy executou rollback do
  checkout para `206259c`. O workflow terminou com falha, sem promocao para
  producao.
- A proxima tentativa exige preflight do modulo HTTP/2 e cobre diretivas
  `listen` com comentario final antes de qualquer escrita.
