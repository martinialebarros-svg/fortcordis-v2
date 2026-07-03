# Plan - institutional-portal-prod-cutover

Data: 2026-07-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (automacao): criar script idempotente para provisionar o server block institucional.
- Fase 2 (workflow): expor a execucao via GitHub Actions manual, usando secrets ja existentes da VPS.
- Fase 3 (validacao): executar a provisao HTTP em producao e registrar evidencias.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar `scripts/provision_institutional_nginx.sh`.
- [x] T1.2 Validar sintaxe shell e probes locais no script.
- Criterio de conclusao: script provisiona `fortcordis.com` e `www.fortcordis.com` por proxy para 3000/8000.
- Risco: config invalida no Nginx.
- Rollback: restaurar backup do site file e recarregar Nginx.

### Fase 2

- [x] T2.1 Criar workflow manual `.github/workflows/provision-institutional-host.yml`.
- [x] T2.2 Compartilhar `concurrency.group` com os deploys da VPS.
- Criterio de conclusao: workflow copia o script para a VPS e executa a provisao com os secrets atuais.
- Risco: workflow rodar sem DNS apontado e tentar TLS cedo demais.
- Rollback: rerun com `enable_tls=false` ou remover site file provisionado.

### Fase 3

- [x] T3.1 Executar workflow manual com `enable_tls=false`.
- [x] T3.2 Confirmar sucesso do run e registrar pendencia de DNS/TLS.
- Criterio de conclusao: Nginx da VPS responde localmente ao host institucional e o workflow fecha verde.
- Risco: ainda nao ha validacao publica sem corte de DNS.
- Rollback: desabilitar symlink do site e recarregar Nginx.

## 3) Plano de testes

- Testes unitarios: nao aplicavel.
- Testes de integracao: `bash -n` no script + parse YAML do workflow + execucao do workflow manual.
- Testes manuais: `curl` local pela propria VPS com `Host: fortcordis.com` e `Host: www.fortcordis.com`.

## 4) Dependencias e bloqueios

- Dependencia 1: secrets `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER` e `VPS_SUDO_PASSWORD` continuam validos no GitHub.
- Dependencia 2: o DNS publico precisa apontar para `216.238.116.77` antes da etapa TLS.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (producao via workflow manual + probes locais).
