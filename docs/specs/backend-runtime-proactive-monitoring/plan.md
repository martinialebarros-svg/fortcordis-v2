# Plan - backend-runtime-proactive-monitoring

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1: criar monitor de 5xx e configuracoes.
- Fase 2: integrar middleware e runtime report.
- Fase 3: validar com testes unitarios.
- Fase 4: fechar verify e promover.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Adicionar configuracoes de janela/threshold 5xx.
- [x] T1.2 Criar servico de monitoramento runtime para 5xx.
- Criterio: monitor em memoria pronto e configuravel.

### Fase 2

- [x] T2.1 Integrar middleware de captura de status code no `main.py`.
- [x] T2.2 Expor estado do worker de cleanup via servico.
- [x] T2.3 Consolidar bloco `observability` no `runtime_report`.
- [x] T2.4 Expor observabilidade em `health` e `ready`.
- Criterio: endpoints de saude com sinais proativos.

### Fase 3

- [x] T3.1 Adicionar testes unitarios do monitor de 5xx.
- [x] T3.2 Rodar testes focados backend.
- Criterio: testes verdes e comportamento esperado validado.

### Fase 4

- [x] T4.1 Criar `verify.md` com rastreabilidade.
- [x] T4.2 Commit e push em `stage`.
- [x] T4.3 Promover para `main`.
- Criterio: ciclo completo encerrado.
