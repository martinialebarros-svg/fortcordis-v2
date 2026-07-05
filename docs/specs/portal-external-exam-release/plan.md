# Plan - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## Fase 1 - Backend

- [x] Criar endpoint para liberar exame externo no portal.
- [x] Validar atendimento, clinica, paciente e PDF anexado antes da liberacao.
- [x] Normalizar `ECG` para `Eletrocardiograma` ao publicar.
- [x] Retornar exame atualizado com anexos para atualizacao imediata da interface.
- [x] Criar upload administrativo de PDF para laudo `eletrocardiograma`.
- [x] Reutilizar PDF externo na liberacao de laudo para o portal.
- [x] Expor download do PDF original para laudos externos.
- [x] Expor substituicao segura do PDF do eletrocardiograma no mesmo laudo.
- [x] Atualizar o anexo do portal quando a substituicao ocorrer apos liberacao.

## Fase 2 - Frontend

- [x] Adicionar `Eletrocardiograma` no dropdown `Laudar` da agenda.
- [x] Criar tela de upload de PDF do eletrocardiograma.
- [x] Remover acao direta `Liberar no portal` do card de exame do atendimento.
- [x] Usar PDF original em `Laudos` para eletrocardiograma.
- [x] Permitir trocar o PDF do eletrocardiograma na tela do laudo.

## Fase 3 - Validacao e rollout

- [x] Adicionar testes backend para liberacao e bloqueio sem PDF.
- [x] Adicionar teste backend para liberacao de eletrocardiograma com PDF externo.
- [x] Adicionar testes backend para substituicao antes e depois da liberacao no portal.
- [x] Executar suites alvo.
- [ ] Publicar em stage.
