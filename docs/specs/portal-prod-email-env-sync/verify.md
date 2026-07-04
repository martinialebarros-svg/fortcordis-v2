# Verify - portal-prod-email-env-sync

Data: 2026-07-03  
Responsavel: Equipe FortCordis  
Status: pending

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `.github/workflows/sync-portal-email-env.yml` com `workflow_dispatch` | ok |
| CA-002 | aceitacao | `scripts/sync_portal_email_env.sh` cria backup do `.env` prod e reinicia `fortcordis-backend` | ok |
| CA-003 | aceitacao | run manual do workflow conclui com `[OK] SMTP handshake validated`, com ou sem login SMTP dependendo do stage | pendente |
| NFR-001 | nao funcional | automacao usa `VPS_SUDO_PASSWORD` sem senha interativa local | ok |
| NFR-002 | nao funcional | workflow compartilha `concurrency.group: fortcordis-vps-deploy` | ok |
| NFR-003 | nao funcional | logs previstos para backup, merge, restart e validacao SMTP | ok |

## 2) Testes automatizados executados

Comandos:

```bash
bash -n scripts/sync_portal_email_env.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/sync-portal-email-env.yml")'
```

Resumo dos resultados:
- Pendente execucao.

## 3) Testes manuais

- Cenario 1: diagnostico em producao:
  - `/var/www/fortcordis-v2/backend/.env` estava sem todas as chaves `PORTAL_EMAIL_*`.
- Cenario 2: execucao do workflow manual:
  - a primeira tentativa mostrou que o stage usa relay SMTP por IP e nao possui `PORTAL_EMAIL_SMTP_USERNAME` nem `PORTAL_EMAIL_SMTP_PASSWORD`; a automacao foi ajustada para aceitar esse modo.

## 4) Regressao e riscos residuais

- Risco residual 1: a automacao depende de o `.env` stage continuar com as credenciais corretas.
- Risco residual 2: apos o handshake SMTP passar, ainda e necessario validar o fluxo real do portal com um email de tutor.
