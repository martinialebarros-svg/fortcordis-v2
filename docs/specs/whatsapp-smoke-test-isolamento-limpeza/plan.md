# Plan - whatsapp-smoke-test-isolamento-limpeza

## Fase 1 - causa raiz

- [x] P1.1 `ENABLE_WHATSAPP_STAGE_SMOKE=0` no deploy de produção
  (`.github/workflows/deploy.yml`); stage inalterado.

## Fase 2 - limpeza segura

- [x] P2.1 `whatsapp-stage-backend/src/controllers/smokeCleanupController.ts`:
  `previewSmokeCleanup` (somente leitura) e `executeSmokeCleanup`
  (admin-only, transacional);
- [x] P2.2 rotas `GET/POST /admin/whatsapp-smoke-cleanup/*` em `app.ts`,
  protegidas por `requireApiAuth` (`app.use("/admin", requireApiAuth)`);
- [x] P2.3 script `scripts/test-smoke-cleanup.ts` (padrão já usado pelos
  demais `scripts/test-*.ts` deste serviço): cria uma conversa/atendente
  de controle (não-smoke) e uma de smoke, roda preview + execute, confirma
  que só a de smoke foi apagada e que `execute` sem papel admin é
  recusado.

## Rollback

- Reverter `ENABLE_WHATSAPP_STAGE_SMOKE` para `1` no deploy de produção
  restaura o comportamento anterior (smoke volta a rodar lá).
- Remover as rotas `/admin/whatsapp-smoke-cleanup/*` não afeta nada mais —
  é um utilitário isolado, sem outro código dependendo dele.
