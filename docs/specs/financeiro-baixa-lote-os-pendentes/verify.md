# Verify - financeiro-baixa-lote-os-pendentes

Data: 2026-06-13
Responsavel: Martiniano + Codex
Status: ready-for-release-user-confirmed-meta-approved

## 1) Matriz de rastreabilidade

| ID | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | Checkbox de OS pendente + botao `Receber selecionadas` | implementado |
| CA-002 | Modal usa total selecionado como valor inicial | implementado |
| CA-003 | Confirmacao chama `/ordens-servico/{id}/receber` para cada OS | implementado |
| CA-004 | Resumo mostra faltante/excedente e bloqueia confirmacao | implementado |
| CA-005 | Checkbox de OS paga continua selecionando para recibo | implementado |
| CA-006 | Botao `Receber pendentes` usa OS pendentes do grupo de clinica | implementado |
| CA-007 | Checkbox de recibo PDF no recebimento individual e endpoint oficial | passou em inspecao, `tsc` e lint |
| CA-008 | Checkbox consolidado condicionado ao mesmo destinatario | passou em inspecao, `tsc` e lint |
| CA-009 | tratamento separado de erro financeiro e erro WhatsApp | passou em inspecao, `tsc` e lint |

## 2) Testes automatizados

Executado:

```bash
cd frontend && npx eslint app/financeiro/page.tsx
cd frontend && npx tsc --noEmit
```

Resultado: ok nos dois comandos.

Testes adicionais da extensao:

```bash
cd backend && venv/bin/python -m unittest tests.test_whatsapp_template_delivery
cd whatsapp-stage-backend && npm run test:document-templates
```

Resultado: 8 testes Python e o teste Node de documento passaram; o teste do PDF consolidado extraiu
OS, data do atendimento, servico, tutor e pet.

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
- Marcar o envio por WhatsApp e confirmar o recebimento do PDF no telefone cadastrado.

## 4) Riscos residuais

- A baixa em lote reaproveita o endpoint individual e nao e atomica no backend; em erro intermediario, o sistema informa conclusao parcial.
- O historico financeiro continua com transacoes vinculadas individualmente por OS, ainda que a operacao operacional tenha sido uma unica baixa em lote.
- A aprovacao dos modelos Meta de recibo com cabecalho de documento foi confirmada pelo responsavel
  em 2026-08-16; a publicacao segue condicionada aos gates e smokes desta entrega.
