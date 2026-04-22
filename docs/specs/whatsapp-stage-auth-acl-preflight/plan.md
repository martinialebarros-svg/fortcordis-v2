# Plan - whatsapp-stage-auth-acl-preflight

## Fases

1. Implementar middleware de auth/ACL no backend WhatsApp stage.
2. Integrar envio de bearer token no frontend `/whatsapp-stage`.
3. Atualizar smoke tests para aceitar autenticacao por env.
4. Endurecer scripts de deploy stage/prod com defaults de auth/ACL.
5. Adicionar preflight operacional e documentacao.
6. Validar build/testes e executar verificacao no stage.

## Tarefas

- [x] T1 Criar `src/middleware/auth.ts` no `whatsapp-stage-backend`.
- [x] T2 Proteger rotas em `src/app.ts`.
- [x] T3 Estender tipo `Express.Request` para `authUser`.
- [x] T4 Ajustar frontend para enviar `Authorization` automaticamente.
- [x] T5 Atualizar `.env.example` e README do backend WhatsApp.
- [x] T6 Ajustar `scripts/smoke-tests.sh` com headers de auth opcionais.
- [x] T7 Ajustar `scripts/deploy_prod_vps.sh` para defaults de auth/ACL/token interno.
- [x] T8 Habilitar smoke no `scripts/deploy_stage_vps.sh`.
- [x] T9 Criar `scripts/whatsapp_stage_preflight.sh`.
- [x] T10 Documentar preflight em docs dedicados e runbook.
- [x] T11 Rodar validacoes locais e smoke remoto.

## Riscos

- R1: deploy via SSH manual sem sudo nao interativo pode falhar em restart de services.
- Mitigacao: usar workflow de deploy com secrets e validar guardrails antes do push.
