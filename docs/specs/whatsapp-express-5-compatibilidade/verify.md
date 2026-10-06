# Verify - whatsapp-express-5-compatibilidade

## Atualizacao de seguranca 2026-10-05

Base: `origin/stage` em `aa6c5cd1`. A publicacao da OS de eletro foi
bloqueada pelo audit de `proxy-addr@2.0.7`; o patch atualiza somente a entrada
desse pacote para `2.0.8` no lockfile, por
`npm update proxy-addr --package-lock-only --ignore-scripts`.
Referencia: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `npm ci` em instalacao propria do worktree e `npm run build` com Node 20.20.2/npm 10.8.2 | aprovado localmente |
| CA-002 | Os 13 scripts sem banco externo do job WhatsApp passaram: reservation-template, approved-templates, document-templates, database-config, express-http, inbox-ui, customer-service-window, phone-number, whatsapp-retry, message-attachment, auth-policy, webhook-cleanup-config e log-redaction | aprovado localmente |
| CA-003 | `test:express-http`, repetido com `env -u DATABASE_URL`, respondeu `200` JSON em `/health` e `404` em rota ausente, somente em loopback/porta efemera | aprovado localmente |
| CA-004 | `npm audit --omit=dev` e `npm audit --omit=dev --audit-level=critical` retornaram zero vulnerabilidades | aprovado localmente |
| CA-005 | Nove assercoes diretas sobre `proxy-addr@2.0.8`: versao, rejeicao de IPv4 externo/spoof de X-Forwarded-For com `::ffff:10.0.0.0/8` e `::/1`, e confianca correta com `10.0.0.0/8` e `::ffff:10.0.0.0/104` | aprovado localmente |

Os testes usaram valores sinteticos e mocks para envios; nenhuma mensagem
real foi enviada. Logs locais em
`/var/folders/6s/4lv007g54pb7l2jj3q9drmtm0000gn/T/fortcordis-proxy-addr-qa-ooxe34rb`.
O install completo reportou quatro avisos high em dependencias de
desenvolvimento; o audit de producao acima e o executado pelo workflow e
retornou zero. Nao houve atualizacao de dependencias adicionais.

Esta secao registra validacao local da correcao. O rollout precisa de
workflows terminais e smoke de stage antes da promocao protegida para main.
As evidencias abaixo sao historicas da migracao para Express 5.

## Evidencia local historica

Executado em worktree isolado baseado em `origin/stage` no commit
`f84c049d66ae0b41fcecf99da35f76e13b815acc`.

| Verificacao | Resultado |
| --- | --- |
| `npm ci` | passou; 0 vulnerabilidades no install |
| `npm run build` | passou com `express@5.2.1` e `@types/express@5.0.6` |
| Testes funcionais listados no workflow | passaram: templates, banco, inbox, janela de atendimento, telefone, retry, anexo (incluindo `:id` invalido -> `400`), auth, cleanup e redacao de logs |
| `npm run test:express-http` | passou: `/health` retornou `200` JSON e `/not-found` retornou `404` |
| `npm audit --omit=dev` | passou; 0 vulnerabilidades |
| `git diff --check` | passou |

## Observacoes de seguranca

- O teste HTTP usou somente loopback e porta efemera.
- A URL padrao de banco do script aponta para localhost e nao foi acessada pelo
  endpoint `/health`.
- Nenhuma mensagem foi enviada nem credencial da Meta foi lida ou exibida.

## Pendencia de rollout

- [x] Enviado para `stage` no commit `e9f79f15`.
- [x] `quality-gate`, `sdd-guardrail` e Migration CI concluiram com sucesso.
- [ ] O Deploy to Stage fez rollback automatico por uma validacao obsoleta do
  gate de workers da PERF-15, nao por Express ou pelo backend WhatsApp. A
  correcao do runtime gate passou, e o segundo deploy revelou que o canario
  administrativo tambem precisava receber o sinal de worker externo; essa
  correcao sera validada e reenviada antes de novo deploy.
- [ ] Executar preflight/smoke autenticado em stage antes de qualquer promocao
  para producao.
