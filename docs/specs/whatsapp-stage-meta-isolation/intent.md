# Intent - whatsapp-stage-meta-isolation

Data: 2026-08-23
Responsaveis: Martiniano + Codex
Status: aprovado para implementacao; configuracao externa pendente

## Problema

O runtime WhatsApp de stage reutiliza o mesmo app Meta, WABA e numero de
producao. Como o app possui um unico callback configurado para
`https://app.fortcordis.com.br/whatsapp/webhook`, mensagens reais entram em
producao e nao chegam a stage. Trocar esse callback para o dominio de stage
interromperia o recebimento de producao.

O deploy de producao tambem sincronizava a identidade Meta a partir do `.env`
protegido de stage. Portanto, trocar apenas as credenciais de stage faria uma
promocao futura copiar a identidade de homologacao para producao.

## Objetivo

- permitir que stage use app Meta, WABA e numero de teste próprios;
- impedir por validacao automatica que stage reutilize qualquer um dos tres IDs
  de producao;
- preservar a identidade Meta ja instalada no runtime de producao sem voltar a
  copia-la de stage;
- manter segredos fora do Git e dos logs;
- deixar o corte externo bloqueado ate os seis valores de stage estarem
  configurados de forma coerente.

## Nao objetivos

- trocar o callback ou cadastrar credenciais no painel Meta nesta iteracao;
- enviar mensagem real para cliente;
- compartilhar eventos reais de producao com o banco de stage;
- publicar a branch, abrir PR ou promover para stage/producao.

## Restricoes e riscos

- o canal Meta de stage deve permanecer desligado enquanto a identidade isolada nao
  estiver cadastrada; o deploy dos outros modulos nao depende desse canal;
- producao nao pode depender de arquivo, variavel ou segredo de stage;
- IDs publicos podem ser GitHub Variables; access token, App Secret e verify
  token continuam GitHub Secrets;
- a configuracao externa exige confirmacao imediatamente antes de criar acesso,
  gravar segredo ou salvar callback;
- rollback nunca deve apontar o callback de producao para stage.

## Estado operacional esclarecido — 25/10/2026

O usuario confirmou que somente producao possui numero registrado na Meta. Stage deve permitir homologar laudos e outros modulos sem ativar transporte Meta. A presenca de segredos antigos nao equivale a autorizacao para ativar esse canal. Uma flag explicita de opt-in liga os controles de identidade completos; ausencia da flag mantem o canal desligado e preserva producao.
