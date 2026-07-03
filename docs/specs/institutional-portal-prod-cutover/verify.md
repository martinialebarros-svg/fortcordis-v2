# Verify - institutional-portal-prod-cutover

Data: 2026-07-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `.github/workflows/provision-institutional-host.yml` com `workflow_dispatch` | ok |
| CA-002 | aceitacao | workflow manual compartilha `concurrency.group: fortcordis-vps-deploy` | ok |
| CA-003 | aceitacao | run manual do workflow `Provision Institutional Host (Manual)` com `enable_tls=false` concluido com sucesso; script logou probes HTTP locais e fim da provisao | ok |
| CA-004 | aceitacao | `scripts/provision_institutional_nginx.sh` exige `CERTBOT_EMAIL` e valida DNS contra `EXPECTED_PUBLIC_IP` antes do `certbot --nginx` | ok |
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

## 3) Testes manuais

- Cenario 1: auditoria DNS antes do corte:
  - `fortcordis.com` e `www.fortcordis.com` ainda resolviam para Squarespace em 2026-07-02.
- Cenario 2: execucao do workflow manual HTTP-only:
  - script provisionou `fortcordis-www` na VPS de producao e recarregou o Nginx com sucesso.
- Cenario 3: probes locais na VPS:
  - `curl -I -H 'Host: fortcordis.com' http://127.0.0.1/` respondeu com sucesso.
  - `curl -I -H 'Host: www.fortcordis.com' http://127.0.0.1/dashboard` respondeu com sucesso via proxy local.

## 4) Regressao e riscos residuais

- Risco residual 1: enquanto o DNS continuar no Squarespace, o publico ainda nao vera a landing pela VPS.
- Risco residual 2: o TLS ainda depende de uma segunda execucao do workflow com `enable_tls=true` depois da propagacao do DNS.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
