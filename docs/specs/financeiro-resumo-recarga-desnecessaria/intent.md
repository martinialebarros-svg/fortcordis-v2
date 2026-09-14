# Intent - financeiro-resumo-recarga-desnecessaria

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Observado durante o aceite de `financeiro-transacoes-pagination`, ao navegar
entre paginas de Transacoes em producao: `/financeiro/resumo` foi chamado de
novo, passando de 2 para 3 chamadas. O valor exibido nao mudou -- e nem poderia,
porque o resumo nao depende de pagina.

Causa: em `frontend/app/financeiro/page.tsx`, `carregarDados` dispara todas as
cargas de uma vez. `cargaTransacoes`, `cargaOrdens` e os catalogos sao
condicionados por `getFinanceiroLoadingPlan(abaAtiva)`; **a carga do resumo nao
tinha condicao nenhuma**. Como o efeito que chama `carregarDados` depende de
`paginaAtualTransacoes`, de todos os filtros, da busca e da aba, o resumo era
refeito em qualquer um desses eventos.

A URL do resumo e `/financeiro/resumo?periodo=${periodo}`: varia **so** com
`periodo`. Toda chamada disparada por troca de pagina, filtro, busca ou aba
devolve exatamente o mesmo corpo.

## 2) Objetivo

O resumo e buscado quando o periodo muda, na primeira carga e depois de mutacao
-- nao ao paginar, filtrar, buscar ou trocar de aba.

## 3) Nao objetivos

- Nao mudar o endpoint nem o que o resumo calcula. Backend intocado.
- Nao mexer no `getFinanceiroLoadingPlan` existente nem no gating das outras
  cargas.
- Nao quebrar `carregarDados` em varios efeitos separados. O ganho nao paga o
  risco de mexer na orquestracao inteira de uma pagina grande.

## 4) Contexto e restricoes

- `carregarDados()` tem 13 pontos de chamada. A maioria e pos-mutacao (receber
  pagamento, cadastrar forma, baixar cobranca) e **precisa** do resumo
  atualizado: o dinheiro mudou sem o periodo mudar. So a chamada do efeito pode
  pular.
- Por isso o default do parametro novo tem de ser "sempre recarrega". Qualquer
  ponto de chamada esquecido continua com o comportamento atual, nao com o novo.
- Dois `onClick={carregarDados}` passavam o handler direto. Com o parametro
  novo, o `MouseEvent` ocuparia `origem` e o resumo deixaria de recarregar
  justamente nos botoes de "Recarregar". Precisam virar `() => carregarDados()`.
- Marcar o periodo como carregado so pode acontecer **depois** do sucesso; falha
  ou cancelamento tem de deixar a proxima carga tentar de novo.

## 5) Severidade

Baixa. Nao ha valor errado em tela em momento nenhum -- e uma requisicao
desperdicada por interacao. Entra como limpeza, nao como correcao urgente.
