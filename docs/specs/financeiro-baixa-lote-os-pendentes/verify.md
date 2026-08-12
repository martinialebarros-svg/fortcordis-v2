# Verify - financeiro-baixa-lote-os-pendentes

Data: 2026-06-13
Responsavel: Martiniano + Codex
Status: verified

## 1) Matriz de rastreabilidade

| ID | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | Checkbox de OS pendente + botao `Receber selecionadas` | implementado |
| CA-002 | Modal usa total selecionado como valor inicial | implementado |
| CA-003 | Confirmacao chama `/ordens-servico/{id}/receber` para cada OS | implementado |
| CA-004 | Resumo mostra faltante/excedente e bloqueia confirmacao | implementado |
| CA-005 | Checkbox de OS paga continua selecionando para recibo | implementado |
| CA-006 | Botao `Receber pendentes` usa OS pendentes do grupo de clinica | implementado |

## 2) Testes automatizados

Executado:

```bash
cd frontend && npx eslint app/financeiro/page.tsx
cd frontend && npx tsc --noEmit
```

Resultado: ok nos dois comandos.

Inspecao local:

```bash
cd frontend && npm run dev
```

Resultado: `GET /financeiro 200`; a tela abriu no browser local sem erro de console, mas permaneceu em `Carregando...` por depender de APIs/autenticacao/dados locais para o fluxo completo.

## 3) Smoke manual recomendado

- Na aba Cobrancas, clicar em `Receber pendentes` numa clinica com 2+ OS e confirmar a baixa.
- Na aba Ordens de Servico, selecionar manualmente 2+ OS pendentes e confirmar a baixa.
- Informar valor menor que o total e conferir bloqueio por faltante.
- Informar valor maior que o total e conferir bloqueio por excedente.
- Selecionar uma OS paga e confirmar que a acao continua sendo recibo.
- Gerar recibo de OS recebida apos a baixa em lote.

## 4) Riscos residuais

- A baixa em lote reaproveita o endpoint individual e nao e atomica no backend; em erro intermediario, o sistema informa conclusao parcial.
- O historico financeiro continua com transacoes vinculadas individualmente por OS, ainda que a operacao operacional tenha sido uma unica baixa em lote.
