# Spec - whatsapp-stage-meta-isolation

Data: 2026-08-23
Responsaveis: Martiniano + Codex
Status: implementado localmente; corte Meta pendente

## Requisitos funcionais

- RF-001: o workflow de stage recebe `WHATSAPP_ACCESS_TOKEN_STAGE`,
  `WHATSAPP_APP_SECRET_STAGE` e `WHATSAPP_VERIFY_TOKEN_STAGE` somente por
  GitHub Secrets.
- RF-002: o workflow de stage recebe `WHATSAPP_PHONE_NUMBER_ID_STAGE`,
  `WHATSAPP_META_APP_ID_STAGE` e `WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE` por
  GitHub Variables.
- RF-003: os seis valores sao validados antes da transmissao e gravados de
  forma atomica no `.env` protegido do servico WhatsApp de stage, sem imprimir
  valores.
- RF-004: stage rejeita IDs ausentes, placeholders, fora do formato ou iguais
  aos IDs de producao.
- RF-005: o preflight aceita valores esperados opcionais e confirma que numero,
  app e WABA de stage sao todos distintos dos de producao.
- RF-006: o deploy de producao deixa de usar
  `/var/www/fortcordis-stage/whatsapp-stage-backend/.env` como fonte Meta,
  preserva o `.env` protegido do proprio runtime e valida os IDs esperados de
  producao.
- RF-007: o exemplo de ambiente nao incorpora IDs reais de producao.
- RF-008: antes de gravar a configuracao, uma consulta somente leitura a Graph
  confirma que o token resolve o numero e que o numero pertence a WABA.
  `NOT_VERIFIED` e aceito somente para numero de teste fornecido pela Meta
  quando o workflow de stage ativa explicitamente
  `WHATSAPP_ALLOW_UNVERIFIED_TEST_NUMBER=1`.
- RF-009: no deploy anterior ao corte do callback, a assinatura do app na WABA
  pode ficar pendente apenas com `WHATSAPP_REQUIRE_SUBSCRIBED_APP=0`. O
  verificador e o preflight usam `1` por padrao e exigem a assinatura para a
  validacao final posterior ao callback.
- RF-010: o workflow carrega `deploy_stage_vps.sh` e `deploy_prod_vps.sh` do
  `origin/stage` em diretorio temporario antes de iniciar o deploy. O checkout
  remoto antigo continua intacto ate o proprio script novo criar o backup dos
  artefatos de runtime e registrar o SHA de rollback.

## Requisitos nao funcionais

- NFR-001 (fail closed): nenhuma ausencia ou mistura parcial de identidade pode
  reiniciar o servico de stage com configuracao ambigua.
- NFR-002 (seguranca): tokens e segredos nao aparecem no Git, documentacao,
  argumentos do deploy ou saida de testes.
- NFR-003 (privacidade): eventos reais de producao nao sao replicados para
  stage.
- NFR-004 (disponibilidade): o callback de producao nao e alterado durante a
  preparacao ou validacao local.
- NFR-005 (rastreabilidade): mudancas de workflow, preflight e deploy possuem
  teste focado e artefatos SDD no mesmo ciclo.

## Contrato de configuracao

| Destino | Tipo | Nome |
| --- | --- | --- |
| GitHub Secret | secreto | `WHATSAPP_ACCESS_TOKEN_STAGE` |
| GitHub Secret | secreto | `WHATSAPP_APP_SECRET_STAGE` |
| GitHub Secret | secreto | `WHATSAPP_VERIFY_TOKEN_STAGE` |
| GitHub Variable | publico | `WHATSAPP_PHONE_NUMBER_ID_STAGE` |
| GitHub Variable | publico | `WHATSAPP_META_APP_ID_STAGE` |
| GitHub Variable | publico | `WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE` |

O runtime converte os tres nomes publicos para `PHONE_NUMBER_ID`, `META_APP_ID`
e `WHATSAPP_BUSINESS_ACCOUNT_ID` no `.env` remoto.

## Ordem do corte

1. Validar localmente o codigo de isolamento, sem publicar ainda.
2. Criar ou selecionar app, WABA e numero de teste exclusivos de stage.
3. Cadastrar os tres GitHub Secrets e as tres GitHub Variables de stage.
4. Publicar o codigo em stage e exigir pipeline, preflight, health e smoke
   assinados com a nova identidade.
5. Salvar no app de stage o callback
   `https://app.stage.fortcordis.com.br/whatsapp/webhook` e assinar `messages`.
6. Enviar mensagem controlada para o numero de teste e comprovar entrada e
   resposta em stage.
7. Revalidar que o callback e a identidade de producao permaneceram intactos.

## Criterios de aceitacao

- CA-001: fixture com identidade isolada passa o preflight.
- CA-002: fixture com qualquer ID de producao falha e nomeia apenas a variavel.
- CA-003: fixture divergente dos valores esperados falha.
- CA-004: nenhum segredo de fixture aparece na saida.
- CA-005: os dois workflows continuam sendo YAML valido.
- CA-006: o workflow de producao nao contem a antiga fonte Meta de stage.
- CA-007: o corte externo permanece pendente e nao e declarado pronto sem teste
  real de entrada e saida.
- CA-008: respostas Graph incompatíveis com qualquer um dos tres IDs interrompem
  o pipeline sem imprimir token ou resposta sensivel; numero `NOT_VERIFIED`
  tambem e recusado sem a autorizacao explicita de modo de teste.
- CA-009: o workflow de stage pode aceitar `NOT_VERIFIED` somente com
  `WHATSAPP_ALLOW_UNVERIFIED_TEST_NUMBER=1`; producao e chamadas sem a flag
  continuam fail-closed.
- CA-010: app nao assinado falha por padrao; somente o pre-corte do workflow de
  stage usa `WHATSAPP_REQUIRE_SUBSCRIBED_APP=0`, enquanto o preflight final
  continua exigindo assinatura.
- CA-011: uma VPS posicionada no SHA anterior executa os scripts de deploy do
  novo `origin/stage`, sem reset antecipado do checkout e sem perder a origem
  do rollback.

## Rollback

- antes do corte Meta: reverter apenas o commit; nenhum ambiente externo muda;
- depois do corte: manter producao intacta e desabilitar somente o app/numero de
  teste de stage enquanto a configuracao e corrigida;
- nunca restaurar compartilhamento de identidade como atalho de rollback.
