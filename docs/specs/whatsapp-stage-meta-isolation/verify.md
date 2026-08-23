# Verify - whatsapp-stage-meta-isolation

Data: 2026-08-23
Responsaveis: Martiniano + Codex
Status: validacao local concluida; prova externa pendente

## Diagnostico atual

- health publico de stage: HTTP `200`;
- tela `/whatsapp-stage`: HTTP `200`;
- rota `/whatsapp/conversations` sem autenticacao: HTTP `401`;
- token instalado no VPS consulta a Graph API com sucesso;
- numero de producao: verificado, qualidade `GREEN`, Cloud API;
- preflight remoto anterior ao isolamento: `PASS`, zero falhas;
- callback confirmado no painel: producao, com `messages` assinado em `v26.0`;
- stage nao registrou webhook real nas 24 horas anteriores ao diagnostico; os
  eventos recentes eram smokes sinteticos.
- os tres Secrets legados de stage existem no GitHub, mas nenhuma das tres
  Variables da nova identidade isolada esta cadastrada; o novo pipeline falhara
  fechado ate o corte externo.

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | fixture isolada em `test_whatsapp_stage_meta_isolation.sh` | passou |
| CA-002 | fixture com os tres IDs de producao | passou, recusada |
| CA-003 | fixture com `PHONE_NUMBER_ID` divergente do esperado | passou, recusada |
| CA-004 | teste verifica access token, App Secret, verify token e token interno | passou, nenhuma exposicao |
| CA-005 | parse Ruby/Psych dos workflows stage/producao | passou |
| CA-006 | teste rejeita a antiga fonte `/var/www/fortcordis-stage/.../.env` no workflow de producao | passou |
| CA-007 | app/WABA/numero exclusivos, deploy e smoke real | pendente |
| CA-008 | Graph mock aceita relacao coerente, rejeita numero divergente e teste somente leitura passou contra a identidade atualmente instalada no VPS | passou |

## Comandos executados

```bash
bash -n scripts/deploy_prod_vps.sh
bash -n scripts/deploy_stage_vps.sh
bash -n scripts/whatsapp_stage_preflight.sh
bash -n scripts/whatsapp_meta_identity_check.sh
bash -n scripts/tests/test_whatsapp_stage_meta_isolation.sh
bash scripts/tests/test_whatsapp_stage_meta_isolation.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy-stage.yml"); YAML.load_file(".github/workflows/deploy.yml")'
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:phone-number
cd whatsapp-stage-backend && npm run test:inbox-ui
git diff --check
```

O novo verificador tambem foi executado por stdin no VPS, sem instalar arquivo
ou exibir segredo. A identidade atual passou nas tres consultas Graph. Ela
continua corretamente bloqueada para uso futuro em stage porque ainda e a mesma
identidade de producao.

O build TypeScript, o teste de identidade telefonica e os contratos da inbox
tambem passaram na rodada final.

## Pendente antes de declarar stage funcional

- app Meta distinto do FortZap de producao;
- WABA e numero de teste exclusivos;
- seis valores cadastrados no GitHub sem exposicao;
- callback de stage verificado e `messages` assinado;
- workflow terminal verde;
- mensagem externa controlada aparecendo na inbox de stage e resposta recebida;
- rechecagem final do callback/health de producao.
