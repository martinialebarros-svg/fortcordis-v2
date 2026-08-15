# Verify - institutional-portal-prod-cutover

Data: 2026-07-03  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `.github/workflows/provision-institutional-host.yml` com `workflow_dispatch` | ok |
| CA-002 | aceitacao | workflow manual compartilha `concurrency.group: fortcordis-vps-deploy` | ok |
| CA-003 | aceitacao | run manual do workflow `Provision Institutional Host (Manual)` com `enable_tls=false` concluido com sucesso; script logou probes HTTP locais e fim da provisao | ok |
| CA-004 | aceitacao | `scripts/provision_institutional_nginx.sh` exige `CERTBOT_EMAIL` e valida DNS contra `EXPECTED_PUBLIC_IP` antes do `certbot --nginx` | ok |
| CA-005 | aceitacao | `ENABLE_TLS=true` vindo do `workflow_dispatch` entra no ramo de TLS e nao fica preso ao valor literal `1` | ok |
| NFR-001 | nao funcional | automacao usa `VPS_SUDO_PASSWORD` via environment do workflow, sem depender de senha interativa no chat | ok |
| NFR-002 | nao funcional | workflow serializado com o mesmo grupo dos deploys da VPS | ok |
| NFR-003 | nao funcional | logs do script incluem backup, `nginx -t`, probes HTTP e etapa TLS | ok |

## 2) Testes automatizados executados

Comandos:

```bash
bash -n scripts/provision_institutional_nginx.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/provision-institutional-host.yml")'
```

Resumo dos resultados:
- Script shell com sintaxe valida.
- Workflow YAML parseado com sucesso antes da publicacao.
- Workflow manual executado via GitHub Actions apos push.
- Regressao do parser booleano coberta por leitura do log do run 28688119715 e pela nova execucao TLS apos a correcao.

## 3) Testes manuais

- Cenario 1: auditoria DNS antes do corte:
  - `fortcordis.com` e `www.fortcordis.com` ainda resolviam para Squarespace em 2026-07-02.
- Cenario 2: execucao do workflow manual HTTP-only:
  - script provisionou `fortcordis-www` na VPS de producao e recarregou o Nginx com sucesso.
- Cenario 3: probes locais na VPS:
  - `curl -I -H 'Host: fortcordis.com' http://127.0.0.1/` respondeu com sucesso.
  - `curl -I -H 'Host: www.fortcordis.com' http://127.0.0.1/dashboard` respondeu com sucesso via proxy local.
- Cenario 4: diagnostico da primeira tentativa TLS em 2026-07-03:
  - o run `28688119715` concluiu verde, mas o log registrou `TLS provisioning skipped (ENABLE_TLS=true)`, identificando incompatibilidade entre o input booleano do workflow e a checagem literal do script.
- Cenario 5: rerun apos a correcao:
  - a automacao deve executar `certbot --nginx` e concluir probes HTTPS locais para `fortcordis.com` e `www.fortcordis.com`.

## 4) Regressao e riscos residuais

- Risco residual 1: enquanto o DNS continuar no Squarespace, o publico ainda nao vera a landing pela VPS.
- Risco residual 2: a emissao do TLS depende apenas da rerun do workflow corrigido com o DNS ja propagado.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
