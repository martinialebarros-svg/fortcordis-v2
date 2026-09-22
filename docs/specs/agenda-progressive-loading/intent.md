# Intent - agenda-progressive-loading

Data: 2026-09-21

Responsavel: Codex / equipe FortCordis

Status: ready_for_stage

## 1) Problema atual

A lista principal da Agenda entrega os agendamentos antes dos dados relacionados, mas mantem o indicador de atualizacao ativo enquanto aguarda relacionados e resumo financeiro. Em mudancas de periodo, o resumo tambem pode ser solicitado pelo efeito dedicado e novamente pela carga principal. Respostas antigas de requisicoes sobrepostas ainda podem substituir o estado de filtros mais recentes.

## 2) Objetivo

Fazer a Agenda carregar progressivamente: a lista principal encerra sua propria fase assim que o contrato `/agenda` responde, enquanto relacionados e resumo financeiro seguem como leituras independentes, paralelas e protegidas contra respostas obsoletas.

## 3) Nao objetivos

- Alterar regras de agendamento, precificacao, pagamento, laudo ou Ordem de Servico.
- Alterar endpoints, payloads ou schema do banco.
- Otimizar nesta fatia as consultas SQL de `/agenda`.
- Promover para producao sem aceite separado depois da validacao em stage.

## 4) Restricoes

- Atualizacoes operacionais devem continuar renovando o resumo financeiro.
- Falha de relacionados ou do resumo nao pode transformar uma carga principal bem-sucedida em erro global.
- Uma resposta iniciada com filtros antigos nao pode substituir uma resposta mais recente.
- A validacao em stage deve usar somente navegacao e leituras, sem criar ou alterar agendamentos.

## 5) Impacto esperado

- O indicador de atualizacao principal deixa de esperar leituras auxiliares.
- A troca de periodo dispara uma unica carga dedicada do resumo financeiro.
- Relacionados e resumo podem progredir em paralelo sem bloquear a lista.
- Trocas rapidas de periodo ou filtros preservam o resultado mais recente.
