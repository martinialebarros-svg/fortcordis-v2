# Intent - agenda-financial-summary-resilience

Data: 2026-04-16  
Responsavel: Codex  
Status: done

## 1) Problema atual

O card financeiro da agenda pode exibir `R$ 0,00` mesmo quando existem agendamentos no dia. Na pratica, uma falha pontual no calculo de preco previsto ou uma diferenca de schema entre ambientes faz a chamada de resumo falhar, e o frontend mascara esse erro como zero.

## 2) Objetivo

Tornar o resumo financeiro da agenda resiliente a falhas pontuais de precificacao e explicitar erro de carregamento no frontend, para que:
- um agendamento problematico nao derrube o resumo inteiro;
- ausencia parcial de tabela/coluna de precificacao nao impeça o fallback para preco base;
- o card nao comunique faturamento zero quando a API estiver indisponivel.

## 3) Nao objetivos

- Nao redesenhar a regra comercial de precificacao.
- Nao alterar o layout geral da agenda alem do estado de erro do card.
- Nao introduzir migracoes de banco nesta rodada.

## 4) Restricoes

- A rota `/agenda/resumo-financeiro` deve seguir restrita a admin.
- O fallback de precificacao precisa preservar comportamento atual quando os dados estiverem integros.
- A entrega precisa atender ao guardrail SDD para liberar deploy automatico em `stage`.
