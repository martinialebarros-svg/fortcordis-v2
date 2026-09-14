# Plan - ci-frontend-gates-sem-paths

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: concluido; CA-002 e CA-003 se provam no PR desta entrega

## 1) Tarefas

- [x] T1 conferir quais checks rodam sempre e quais tem condicao, antes de
      recomendar o que marcar como obrigatorio.
- [x] T2 remover o `paths` dos dois gatilhos.
- [x] T3 registrar o motivo no cabecalho do workflow.
- [x] T4 validar o YAML.
- [x] T5 marcar a revisao do RF-004 nas duas specs anteriores, em vez de
      reescreve-las.
- [ ] T6 CA-002/CA-003: ver os dois checks aparecerem e passarem neste PR, que
      nao toca `frontend/`.

## 2) Ordem e dependencias

T1 antes de tudo. Sem ele a recomendacao seria "marque todos", que travaria todo
PR de documentacao e todo PR de feature para `stage`.

T5 depois de T2 porque so faz sentido revisar o requisito depois de saber qual e
o novo comportamento.

## 3) Risco

Baixo. O unico efeito e CI rodando mais: cerca de 1 min a mais por PR que nao
toca frontend.

O risco que este diff **elimina** e maior que o que cria: com o filtro no lugar
e os checks obrigatorios, todo PR so de documentacao ficaria parado para sempre,
sem erro visivel -- o tipo de travamento que custa tempo justamente porque nao
parece falha.

Risco residual: alguem reintroduzir o `paths` mais adiante, achando que e
otimizacao obvia. Mitigado pelo comentario no cabecalho do workflow (RT-002) e
por esta spec.

Rollback: reverter o commit. Os checks voltam a ser filtrados e deixam de ser
seguros como obrigatorios.

## 4) Entrega

Pre-requisito para a ruleset que o responsavel esta montando. Entra por `stage`
no fluxo normal.
