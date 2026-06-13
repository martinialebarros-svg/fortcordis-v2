# Intent - financeiro-pendencias-cobranca-pdf

Data: 2026-06-12
Responsavel: Martiniano + Codex
Status: done

## 1) Problema

Ao clicar em `Baixar PDF` nas pendencias de pagamento do modulo Financeiro, a tela exibia erro generico e o arquivo nao era gerado.

## 2) Objetivo

Restabelecer o download do relatorio PDF de cobranca de OS pendentes, mantendo o layout atual e melhorando a exibicao de mensagens tecnicas vindas da API em respostas de download.

## 3) Contexto tecnico

O endpoint `/ordens-servico/relatorios/pendencias/pdf` reaproveita a infraestrutura ReportLab do backend. A falha ocorria dentro da montagem do documento, antes de retornar o stream PDF ao navegador.

## 4) Valor esperado

- secretaria consegue gerar o PDF de cobranca por clinica ou geral sem interrupcao;
- erros futuros do endpoint ficam mais claros para suporte e operacao;
- deploy segue o guardrail SDD com escopo documentado.

## 5) Nao objetivos

- redesenhar o relatorio;
- alterar filtros financeiros;
- implementar envio automatico do PDF por WhatsApp.
