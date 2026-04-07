# WhatsApp Stage Backend (Node.js + TypeScript)

Backend minimal para stage local, integrando com WhatsApp Cloud API (Meta), com webhook validado por assinatura, persistencia em Postgres e endpoints de conversa/agente.

## Stack

- Node.js 18+
- TypeScript + Express
- PostgreSQL (`pg`)
- Axios (Graph API)
- Dotenv

## Estrutura

```text
.
+- docker-compose.yml
+- Dockerfile
+- package.json
+- tsconfig.json
+- .env.example
+- migrations/
¦  +- init.sql
+- scripts/
¦  +- smoke-tests.sh
+- src/
   +- app.ts
   +- index.ts
   +- controllers/
   +- services/
   +- db/
   ¦  +- migrate.ts
   +- models/
   +- utils/
```

## Setup rapido

1. Copie as variaveis:

```bash
cp .env.example .env
```

2. Preencha os valores reais em `.env`.

3. Suba o Postgres:

```bash
docker-compose up -d db
```

4. Instale dependencias:

```bash
npm install
```

5. Rode migration:

```bash
npm run migrate
```

6. Rode API em dev:

```bash
npm run dev
```

API sobe em `http://localhost:3000` por padrao.

## Rodar tudo via Docker Compose (opcional)

```bash
docker-compose up -d --build
```

## Endpoints principais

- `GET /webhook` (verificacao Meta)
- `POST /webhook` (mensagens/status/contacts com `X-Hub-Signature-256`)
- `GET /conversations`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`
- `POST /conversations/:id/claim`
- `POST /conversations/:id/unclaim`
- `GET /agents`
- `POST /agents`

## Smoke tests

O script inclui validacao de assinatura no webhook e testes basicos de fluxo:

```bash
bash scripts/smoke-tests.sh
```

Tambem funciona com `BASE_URL` customizado:

```bash
BASE_URL=http://localhost:3000 bash scripts/smoke-tests.sh
```

## Observacoes

- `POST /webhook` exige assinatura valida por padrao.
- Para debug local sem assinatura (nao recomendado), use `WEBHOOK_ALLOW_UNSIGNED=true` no `.env`.
- TODO: adicionar autenticacao/ACL nos endpoints de agentes/conversas antes de producao.
