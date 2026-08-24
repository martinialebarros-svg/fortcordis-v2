# Verify - whatsapp-stage-meta-isolation

Data: 2026-08-23
Responsaveis: Martiniano + Codex
Status: identidade isolada, callback e transporte E2E validados em stage

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
- token permanente `SYSTEM_USER`, sem expiracao, validado por Graph contra app,
  WABA e numero e salvo no GitHub sem exposicao;
- usuario de sistema isolado `FortZap Stage` (`61593589415414`) criado com
  acesso apenas ao app de stage e ao WABA de teste;
- verificacao da conta concluida no perfil reconhecido do Chrome; token emitido
  com apenas `whatsapp_business_management` e
  `whatsapp_business_messaging`.
- primeiro deploy do SHA `786f3ed5` (run `32636366659`) passou SDD e quality
  gate, mas falhou antes de gravar/reiniciar o runtime porque o numero fornecido
  pela Meta e de teste e retorna `code_verification_status=NOT_VERIFIED`.
- guardrail corrigido para aceitar esse estado somente com
  `WHATSAPP_ALLOW_UNVERIFIED_TEST_NUMBER=1` no workflow de stage; sem a flag, o
  mesmo estado continua falhando fechado.
- segundo deploy do SHA `9834ce53` (run `32636752681`) confirmou numero e WABA,
  mas falhou porque o app ainda nao esta assinado. A assinatura pertence a P10,
  depois do deploy e junto ao callback; o pre-corte foi separado do preflight
  final sem mudar o default fail-closed.
- terceiro deploy do SHA `18008107` (run `32637005889`) passou a configuracao
  isolada e os guardrails pre-corte, mas a VPS iniciou a copia antiga de
  `deploy_stage_vps.sh` antes do `git fetch/reset` interno. Essa copia ainda
  exigia os IDs de producao, falhou e reverteu com sucesso para `2588bfc4`.
  O workflow passou a carregar os dois scripts de deploy diretamente do novo
  `origin/stage` em diretorio temporario, preservando o checkout e os artefatos
  de runtime ate o backup/rollback controlado pelo script novo.
- quarto deploy do SHA `abc5a380` (run `32637525688`) concluiu com sucesso. O
  runtime registrou o HEAD `abc5a38`, validou a configuracao Meta de Stage,
  confirmou health do backend WhatsApp, executou seus smokes, o canario
  autenticado e o restore drill. Migration CI `32637525655` tambem concluiu
  com sucesso no mesmo SHA.
- o verify token exclusivo de stage foi rotacionado sem exposicao, salvo no
  GitHub Secret em `2026-08-23T13:45:45Z` e sincronizado no runtime pela
  tentativa 2 do run `32637525688`, concluida com sucesso as `13:50:55Z`;
- a Meta aceitou o desafio do callback
  `https://app.stage.fortcordis.com.br/whatsapp/webhook` no app
  `FortZap Stage` e assinou `messages` em `v26.0` as `10:52:16`;
- as URLs legais publicas de stage (`/privacidade`, `/termos` e
  `/exclusao-de-dados`) foram salvas no app e o FortZap Stage foi publicado com
  confirmacao visual da Meta;
- o numero de Martiniano, previamente verificado na lista de destinatarios de
  teste, foi selecionado. A mensagem padrao de teste da Meta foi enviada e o
  painel registrou `sent` e `delivered`; o recebimento no celular foi confirmado
  pelo destinatario;
- o primeiro teste de resposta real provou que publicar o app nao bastava: a
  Meta recebeu o texto, mas a inbox de stage nao o persistiu;
- a consulta `GET /4413513738886247/subscribed_apps` revelou somente o app
  interno `WA DevX Webhook Events 1P App`; o `FortZap Stage` nao estava inscrito
  na WABA. `POST /4413513738886247/subscribed_apps` adicionou o app de stage sem
  remover a inscricao interna;
- a consulta Graph posterior confirmou duas inscricoes e o App ID
  `1683447519419173` associado a `FortZap Stage`;
- apos a inscricao, a mensagem real controlada apareceu na inbox como
  `Recebida`, com a conversa de Martiniano em `Em atendimento`, sem atendente e
  sem marcador de resposta automatica. Isso tambem provou que o App Secret
  instalado valida corretamente `X-Hub-Signature-256`; a abertura/rotacao do
  segredo foi cancelada e nenhum novo deploy foi feito;
- smokes externos posteriores: raiz de stage `200`; `/whatsapp-stage` `307`
  para autenticacao e `200` seguindo o redirecionamento; health WhatsApp `200`;
  rota de conversas anonima `401`; host `app.stage` com health `200` e webhook
  sem challenge `403`.
- producao permaneceu em `447ddc53` e foi revalidada com raiz/health `200` e
  rota protegida `401`. Nenhum callback foi alterado.

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | fixture isolada em `test_whatsapp_stage_meta_isolation.sh` | passou |
| CA-002 | fixture com os tres IDs de producao | passou, recusada |
| CA-003 | fixture com `PHONE_NUMBER_ID` divergente do esperado | passou, recusada |
| CA-004 | teste verifica access token, App Secret, verify token e token interno | passou, nenhuma exposicao |
| CA-005 | parse Ruby/Psych dos workflows stage/producao | passou |
| CA-006 | teste rejeita a antiga fonte `/var/www/fortcordis-stage/.../.env` no workflow de producao | passou |
| CA-007 | app/WABA/numero exclusivos, token permanente, deploy, callback, publicacao, inscricao Graph, envio entregue e inbound persistido na inbox | passou |
| CA-008 | Graph mock aceita relacao coerente, rejeita numero divergente e teste somente leitura passou contra a identidade atualmente instalada no VPS | passou |
| CA-009 | numero Meta `NOT_VERIFIED` falha por padrao e passa apenas com modo de teste explicito de stage | passou localmente |
| CA-010 | app nao assinado falha por padrao e passa somente no modo pre-corte; preflight final segue exigindo assinatura | passou localmente |
| CA-011 | teste exige bootstrap dos scripts pelo novo `origin/stage` e rejeita chamada direta da copia antiga na VPS | passou localmente |

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
- O token permanente foi classificado pela Meta como `SYSTEM_USER`, com
  `expires_at=0`, App ID `1683447519419173` e permissoes concedidas
  `whatsapp_business_management` e `whatsapp_business_messaging`.
- As consultas Graph confirmaram que o WABA `4413513738886247` contem o Phone
  Number ID `1161616897025933` e que o numero responde com essa identidade.
- `WHATSAPP_ACCESS_TOKEN_STAGE` foi atualizado no GitHub em
  `2026-08-23T11:19:26Z`; o valor nao foi impresso nem salvo em arquivo e a area
  de transferencia foi limpa.
- O usuario de sistema `FortZap Stage` (`61593589415414`) tem exatamente dois
  ativos: app `FortZap Stage` com acesso total e WABA de teste com visualizacao
  de numeros e permissao de mensagens. Producao nao foi atribuida.
- A verificacao no perfil reconhecido do Chrome permitiu selecionar o app
  `FortZap Stage`, expiracao `Nunca` e somente as duas permissoes de WhatsApp;
  o token permanente foi emitido e validado.
- `WHATSAPP_VERIFY_TOKEN_STAGE` foi rotacionado no GitHub em
  `2026-08-23T13:45:45Z`, sincronizado no VPS e descartado da memoria da sessao
  depois que a Meta aceitou o callback; o valor nao foi impresso nem mantido na
  area de transferencia.
- O callback do app `FortZap Stage` foi verificado em
  `https://app.stage.fortcordis.com.br/whatsapp/webhook`; `messages` esta
  assinado em `v26.0`. A Meta tambem manteve/assinou automaticamente campos
  operacionais frequentes do WABA; nenhum deles foi removido por inferencia.
- O app `FortZap Stage` foi publicado depois que a Meta validou as URLs legais
  publicas de stage.
- O destinatario controlado recebeu a mensagem de saida. O primeiro inbound
  apos a publicacao nao chegou ao runtime porque o app ainda nao estava inscrito
  na WABA.
- A Graph API confirmou e corrigiu a inscricao: `FortZap Stage`
  (`1683447519419173`) e o app interno da Meta ficaram inscritos simultaneamente
  na WABA `4413513738886247`.
- O inbound posterior a inscricao foi persistido e exibido na inbox de stage
  como `Recebida`; nenhum envio automatico foi observado.

## Pendente depois do transporte E2E

- executar, quando houver acesso remoto seguro, o comando formal
  `RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh` sem o bypass pre-corte;
  a assinatura obrigatoria ja foi comprovada diretamente pela Graph e pelo E2E,
  mas o script remoto final ainda nao foi executado nesta rodada;
- validar separadamente o pipeline do chatbot em `suggest`: job, rascunho,
  tokens/tools e ausencia de envio automatico. Isso nao faz parte do transporte
  Meta/Node concluido aqui;
- rechecagem visual final do callback de producao; health e protecao HTTP foram
  revalidados e producao permaneceu inalterada.

## Incidente: deploy de producao falha por copiar o `.env` Meta de stage (2026-08-23)

Descoberto ao revalidar `origin/main` no fim da sessao do chatbot. **Nao foi
causado pelo trabalho do bot**, mas e consequencia direta do isolamento Meta
feito nesta spec.

### Sintoma

Run `32673655040` (`Deploy to VPS`, SHA `683195bd`, PR #71 promovendo o #70):

```
[ERROR] PHONE_NUMBER_ID nao corresponde ao numero Fort Cordis aprovado.
[ERROR] META_APP_ID nao corresponde ao app FortZap aprovado.
[ERROR] WHATSAPP_BUSINESS_ACCOUNT_ID nao corresponde a WABA Fort Cordis.
[ERROR] Deploy failed at stage 'whatsapp_stage_backend' (exit=1).
[23:41:35] Automatic rollback completed successfully (HEAD=447ddc5)
```

### Causa raiz

A correcao que impede producao de copiar o `.env` de stage **existe so em
`origin/stage`**. O PR #71 promoveu apenas o #70 (agenda), entao `main` ficou
com a versao antiga:

| | `origin/main` | `origin/stage` |
| --- | --- | --- |
| `.github/workflows/deploy.yml` | `WHATSAPP_META_SOURCE_ENV_FILE=/var/www/fortcordis-stage/whatsapp-stage-backend/.env` | `WHATSAPP_EXPECTED_PHONE_NUMBER_ID/META_APP_ID/BUSINESS_ACCOUNT_ID` explicitos |
| `scripts/deploy_prod_vps.sh` | valores esperados **hardcoded**, nao le `WHATSAPP_EXPECTED_*` | parametrizado por `WHATSAPP_EXPECTED_*` |

Encadeamento: o deploy de producao copia as chaves Meta do `.env` de stage na
VPS; stage passou a ter identidade **de teste** propria (app `1683447519419173`,
WABA `4413513738886247`, numero `1161616897025933`); o guard de producao compara
contra os valores aprovados (`1279142515283484`, `975334532125008`,
`1369494994627980`); os tres divergem e o deploy aborta.

Enquanto stage e producao compartilhavam identidade, a copia era inofensiva. O
isolamento a transformou em armadilha — e o guard fez exatamente o que devia:
falhou fechado em vez de subir producao com identidade de teste.

### Estado resultante

- **Produção roda `447ddc53`**, nao `683195bd`. O ultimo deploy de producao bem
  sucedido foi em 2026-08-22. A correcao de agenda do #70/#71 **nao esta no ar**
  apesar de mergeada em `main`.
- **A migracao `20260823_75` foi aplicada antes da falha** (`MIGRATIONS_OK` no
  log) e o codigo voltou. O banco de producao esta a frente do codigo que roda;
  como a migracao so adiciona colunas, e tolerado, mas e descasamento real.
- **O rollback restaura apenas codigo.** O log mostra que ele nao reexecutou a
  etapa `whatsapp_stage_backend`: nao ha sincronizacao, validacao nem restart do
  servico Node no trecho posterior ao rollback.
- **Risco latente nao confirmado**: no script, a sincronizacao (linha ~509)
  roda ANTES da validacao (linha ~689). Entao o `.env` de producao
  provavelmente ja foi sobrescrito com a identidade de teste e o rollback nao o
  desfez. O servico nao chegou a reiniciar, entao segue em memoria com a
  configuracao correta — mas o proximo restart subiria producao apontando para o
  numero de teste. **Confirmar exige acesso a VPS; nao foi feito.**
- Producao responde normalmente: raiz `200`, `/whatsapp/health` `200`, rota
  protegida `401`. O health nao expoe identidade Meta, entao nao serve para
  confirmar o item acima.

### Correcao proposta (nao executada)

1. **Primeiro, inspecionar `whatsapp-stage-backend/.env` na VPS de producao** e
   restaurar `PHONE_NUMBER_ID`, `META_APP_ID` e `WHATSAPP_BUSINESS_ACCOUNT_ID`
   aprovados, se tiverem sido sobrescritos. Sem isso, qualquer novo deploy
   continua falhando no mesmo guard, agora por causa do proprio arquivo.
2. **Hotfix em `main`** removendo a linha `WHATSAPP_META_SOURCE_ENV_FILE=...` de
   `.github/workflows/deploy.yml`. E o menor diff correto: com a variavel vazia,
   `deploy_prod_vps.sh` pula a sincronizacao (`if [[ -n ... ]]`) e valida o
   `.env` que ja esta no servidor, contra os valores certos que ele ja tem
   hardcoded. Pelo `CLAUDE.md`, isso e branch `hotfix/<slug>` mirando `main`,
   com backport imediato para `stage`.
3. **Rerodar o deploy de producao** e confirmar que `683195bd` sobe.

Alternativa descartada por ora: promover `stage -> main` inteiro traria a versao
parametrizada do script, mas levaria junto **todo o chatbot** para producao.
Ainda que ele nasca desligado (`WHATSAPP_BOT_ENABLED=False` e toggle do banco
`false`), isso contraria a decisao registrada de producao nunca ter recebido o
bot antes dos numeros do P6.3.
