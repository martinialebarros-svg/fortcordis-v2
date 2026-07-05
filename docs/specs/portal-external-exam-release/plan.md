# Plan - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## Fase 1 - Backend

- [x] Criar endpoint para liberar exame externo no portal.
- [x] Validar atendimento, clinica, paciente e PDF anexado antes da liberacao.
- [x] Normalizar `ECG` para `Eletrocardiograma` ao publicar.
- [x] Retornar exame atualizado com anexos para atualizacao imediata da interface.

## Fase 2 - Frontend

- [x] Adicionar botao `Liberar no portal` no card do exame do atendimento.
- [x] Bloquear acao visualmente quando nao houver PDF anexado.
- [x] Atualizar o card para `Liberado no portal` apos sucesso.

## Fase 3 - Validacao e rollout

- [x] Adicionar testes backend para liberacao e bloqueio sem PDF.
- [x] Executar suites alvo.
- [ ] Publicar em stage.
