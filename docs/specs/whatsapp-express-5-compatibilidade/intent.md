# Intent - whatsapp-express-5-compatibilidade

## Problema

O `whatsapp-stage-backend` usava Express 4.22.2. A auditoria de dependencias
do pipeline apontou vulnerabilidades moderadas cuja correcao disponivel exige
a atualizacao para Express 5. Uma atualizacao de major sem verificacao pode
interromper rotas de webhook, inbox e envio de mensagens.

## Objetivo

Atualizar o runtime e os tipos para Express 5.2.1 com uma verificacao de
compilacao, contratos existentes e um smoke HTTP local que confirme que a
aplicacao inicializa e preserva respostas basicas esperadas.

## Fora de escopo

- Alterar a configuracao da Meta, callback, credenciais ou identidade de stage.
- Enviar mensagens reais pela Graph API.
- Alterar contratos funcionais de conversas alem da validacao segura do
  parametro de rota.

## Riscos e mitigacoes

- Tipos mais estritos podem expor valores de rota ambiguos. Mitigacao: validar
  que `:id` e texto antes de consultar banco ou enviar uma mensagem.
- Middleware, parsing JSON ou tratamento de rotas podem variar entre majors.
  Mitigacao: executar o servidor real em porta efemera e verificar `/health`
  (`200` JSON) e uma rota inexistente (`404`) no CI.
- O backend carrega a configuracao de banco ao iniciar. Mitigacao: o smoke usa
  uma URL local inerte apenas para satisfazer a configuracao; ele nao acessa o
  banco nem a Graph API.

## Definition of Ready

- [x] Atualizacao de dependencia e risco de compatibilidade identificados.
- [x] Escopo limitado ao backend WhatsApp e ao pipeline de qualidade.
- [x] Nenhuma acao externa sera executada como parte dos testes.
