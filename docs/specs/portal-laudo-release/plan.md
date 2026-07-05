# Plan - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: in-progress

## Fase 1 - Backend administrativo

- [x] Criar constante compartilhada de status de portal.
- [x] Adicionar endpoint de liberacao em `laudos.py`.
- [x] Validar clinica/paciente antes de publicar.
- [x] Sincronizar `exames` a partir do laudo liberado.
- [x] Gerar PDF final durante a liberacao.
- [x] Persistir/reutilizar anexo PDF baixavel vinculado ao `exame_id`.
- [x] Retornar metadados do PDF na resposta administrativa.

## Fase 2 - Backend portal

- [x] Aplicar filtro de liberacao explicita na listagem da clinica.
- [x] Aplicar filtro de liberacao explicita na listagem do tutor.
- [x] Bloquear download-url para exame nao liberado.
- [x] Usar data operacional do exame nos filtros/ordenacao do portal.
- [x] Tratar `data_inicio` sem `data_fim` como busca de dia unico.

## Fase 3 - Frontend

- [x] Adicionar botao de liberacao na listagem de laudos.
- [x] Adicionar botao/estado de liberacao na visualizacao do laudo.
- [x] Atualizar badge visual para `Liberado no portal`.
- [x] Preencher `Ate` automaticamente ao selecionar `De` no painel da clinica.
- [x] Exibir data de realizacao do exame antes da data de liberacao nos resultados do portal.

## Fase 4 - Validacao e rollout

- [x] Adicionar testes unitarios/backend do endpoint de liberacao.
- [x] Adicionar teste de idempotencia do anexo PDF.
- [x] Adicionar teste do filtro por data de realizacao do exame.
- [x] Atualizar testes do portal para exigir liberacao explicita.
- [x] Executar suites alvo.
- [ ] Publicar em stage.
