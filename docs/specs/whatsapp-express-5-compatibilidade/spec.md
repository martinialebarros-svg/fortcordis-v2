# Spec - whatsapp-express-5-compatibilidade

## Escopo

O `whatsapp-stage-backend` deve usar `express@5.2.1` e `@types/express@5`.

## Requisitos funcionais

- RF-001: `POST /conversations/:id/messages` deve aceitar somente um `id` de
  rota textual; valor ausente, vazio ou em formato inesperado recebe `400`
  antes de acessar banco ou Graph API.
- RF-002: o contrato valido de envio de texto e anexo permanece inalterado.
- RF-003: a aplicacao deve responder `200` JSON em `GET /health` apos iniciar
  com Express 5.
- RF-004: rota nao registrada deve continuar respondendo `404`.

## Requisitos nao funcionais

- NFR-001: `npm run build` deve compilar com os tipos do Express 5.
- NFR-002: `npm run test:express-http` deve iniciar o app em `127.0.0.1`,
  porta efemera, sem abrir conexao de banco nem enviar mensagens externas.
- NFR-003: os workflows de stage e producao devem executar o smoke antes de
  `npm audit --omit=dev`.
- NFR-004: o smoke deve carregar as declaracoes de tipo locais com
  `ts-node --files`, incluindo a extensao `Request.rawBody` usada pela
  verificacao de assinatura do webhook.

## Compatibilidade e rollout

A mudanca e aplicada primeiro em `stage`. Producao so pode receber o mesmo
snapshot depois de workflow terminal verde e smoke autenticado de stage.
O smoke automatizado nao substitui a verificacao autenticada nem o preflight
da integracao WhatsApp em stage.

## Criterios de aceitacao

- CA-001: `npm run build` passa com Express 5.
- CA-002: os testes existentes de retry, anexos, autenticacao e contratos da
  inbox passam sem chamar a Graph API real.
- CA-003: `npm run test:express-http` passa sem `DATABASE_URL` previamente
  definido no shell.
- CA-004: `npm audit --omit=dev` retorna sem vulnerabilidades.
