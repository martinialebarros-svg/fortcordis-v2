# Verify - whatsapp-stage-meta-isolation

Data: 2026-08-23
Responsaveis: Martiniano + Codex
Status: validacao local concluida; identidade externa criada; token permanente,
deploy, callback e E2E pendentes

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
- app `FortZap Stage` criado com App ID `1683447519419173`;
- WABA de teste `4413513738886247` e Phone Number ID `1161616897025933`;
- tres Variables e tres Secrets de stage cadastrados no GitHub sem exposicao;
- token temporario validado por Graph contra app, WABA e numero, mas expira em
  `2026-08-23 09:00 -03:00`;
- usuario de sistema isolado `FortZap Stage` (`61593589415414`) criado com
  acesso apenas ao app de stage e ao WABA de teste;
- emissao do token sem expiracao bloqueada por verificacao repetida da conta
  Meta, mesmo apos dois codigos SMS e recarga do painel.

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | fixture isolada em `test_whatsapp_stage_meta_isolation.sh` | passou |
| CA-002 | fixture com os tres IDs de producao | passou, recusada |
| CA-003 | fixture com `PHONE_NUMBER_ID` divergente do esperado | passou, recusada |
| CA-004 | teste verifica access token, App Secret, verify token e token interno | passou, nenhuma exposicao |
| CA-005 | parse Ruby/Psych dos workflows stage/producao | passou |
| CA-006 | teste rejeita a antiga fonte `/var/www/fortcordis-stage/.../.env` no workflow de producao | passou |
| CA-007 | app/WABA/numero exclusivos criados; deploy, callback e smoke real ainda nao executados | parcial |
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

## Evidencia externa executada em 2026-08-23

- App ID `1683447519419173`, WABA ID `4413513738886247` e Phone Number ID
  `1161616897025933` sao distintos da identidade de producao.
- `WHATSAPP_PHONE_NUMBER_ID_STAGE`, `WHATSAPP_META_APP_ID_STAGE` e
  `WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE` aparecem no GitHub Variables com os IDs
  esperados.
- `WHATSAPP_APP_SECRET_STAGE`, `WHATSAPP_VERIFY_TOKEN_STAGE` e
  `WHATSAPP_ACCESS_TOKEN_STAGE` aparecem no GitHub Secrets; valores nao foram
  impressos nem persistidos em arquivo.
- O token temporario retornou identidade coerente para o app, WABA e numero e
  foi classificado pela Meta como `USER`, com expiracao em
  `2026-08-23 09:00 -03:00`.
- O usuario de sistema `FortZap Stage` (`61593589415414`) tem exatamente dois
  ativos: app `FortZap Stage` com acesso total e WABA de teste com visualizacao
  de numeros e permissao de mensagens. Producao nao foi atribuida.
- A Meta aceitou dois codigos SMS, mas continuou exibindo `Verificar conta` ao
  tentar gerar token `Nunca` com `whatsapp_business_management` e
  `whatsapp_business_messaging`. O token permanente nao foi emitido.

## Pendente antes de declarar stage funcional

- concluir verificacao/2FA da conta Meta em navegador reconhecido;
- gerar token do usuario de sistema sem expiracao, validar Graph e substituir o
  token temporario no GitHub;
- callback de stage verificado e `messages` assinado;
- workflow terminal verde;
- mensagem externa controlada aparecendo na inbox de stage e resposta recebida;
- rechecagem final do callback/health de producao.
