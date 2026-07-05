# Plan - financeiro-pendencias-cobranca-pdf

Data: 2026-06-12
Responsavel: Martiniano + Codex
Status: done

## 1) Diagnostico

- Localizar o handler frontend do botao `Baixar PDF`.
- Localizar o endpoint backend `/ordens-servico/relatorios/pendencias/pdf`.
- Identificar a excecao que impedia a geracao do documento.

## 2) Implementacao

- Corrigir a montagem do `SimpleDocTemplate` do PDF de pendencias para nao depender de variavel inexistente.
- Extrair mensagem `detail` de erros recebidos como `blob` no fluxo de download.
- Reaproveitar o mesmo helper de leitura de erro no fluxo de recibos, preservando comportamento existente.

## 3) Validacao

- Compilar o endpoint Python no venv do backend.
- Gerar um PDF focal via `_gerar_pdf_cobranca_pendencias` e conferir assinatura `%PDF`.
- Rodar lint focal da tela Financeiro.
- Rodar TypeScript do frontend.
- Rodar guardrail SDD local.
- Monitorar GitHub Actions no deploy.

## 4) Dependencias e bloqueios

- Ambiente `backend/venv` com dependencias do backend instaladas.
- Dependencias Node do frontend ja presentes para `eslint` e `tsc`.
- Deploy condicionado ao sucesso do `sdd-guardrail` e do `quality-gate`.

## 5) Rollback

Se houver regressao, reverter o commit do hotfix e restaurar a versao anterior do endpoint e da tela Financeiro.
