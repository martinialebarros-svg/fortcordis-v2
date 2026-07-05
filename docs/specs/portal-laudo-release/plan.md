# Plan - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: in-progress

## Fase 1 - Backend administrativo

- [x] Criar constante compartilhada de status de portal.
- [x] Adicionar endpoint de liberacao em `laudos.py`.
- [x] Validar clinica/paciente antes de publicar.
- [x] Sincronizar `exames` a partir do laudo liberado.

## Fase 2 - Backend portal

- [x] Aplicar filtro de liberacao explicita na listagem da clinica.
- [x] Aplicar filtro de liberacao explicita na listagem do tutor.
- [x] Bloquear download-url para exame nao liberado.

## Fase 3 - Frontend

- [x] Adicionar botao de liberacao na listagem de laudos.
- [x] Adicionar botao/estado de liberacao na visualizacao do laudo.
- [x] Atualizar badge visual para `Liberado no portal`.

## Fase 4 - Validacao e rollout

- [x] Adicionar testes unitarios/backend do endpoint de liberacao.
- [x] Atualizar testes do portal para exigir liberacao explicita.
- [x] Executar suites alvo.
- [ ] Publicar em stage.
