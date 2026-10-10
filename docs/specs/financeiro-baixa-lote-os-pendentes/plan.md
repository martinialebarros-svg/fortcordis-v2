# Plan - financeiro-baixa-lote-os-pendentes

Data: 2026-10-10
Responsavel: Martiniano + Codex
Status: implementado e validado localmente

## 1) Implementacao

- Extrair regras compartilhadas de recebimento sem commit intermediario.
- Criar endpoint atomico, lock de todas as OS, comparacao de valores e rateio em centavos.
- Proteger cancelamento/exclusao concorrentes com o recebimento.
- Substituir loop da UI por uma requisicao; congelar selecao e valores conferidos.
- Exigir sucesso completo antes de pedir recibo e apresentar falha no modal.

## 2) Validacao

- Testes de rollback, status, valores, repeticao, rateio e auditoria em banco sintetico.
- Duas sessoes PostgreSQL disputando pagamento, cancelamento e lotes sobrepostos.
- Testes da UI para sucesso integral, conflito, resposta incompleta e falha de rede.
- Lint/typecheck/build e gate SDD; regressao dos fluxos individuais afetados.
- Integrar os testes ao pipeline de homologacao e conferir deploy terminal e bundle servido.

## 3) Falha segura e retorno

- Qualquer erro anterior ao commit executa rollback integral.
- WhatsApp apos commit continua independente e nao desfaz baixa valida.
- Reverter o commit restaura o comportamento anterior; nao ha migracao de banco.
- Nao usar OS reais para provar disputa ou recebimento. Sessao autenticada e dados
  sinteticos sao requisitos para um ensaio manual no ambiente publicado.
