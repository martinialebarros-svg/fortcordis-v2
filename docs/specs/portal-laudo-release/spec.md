# Spec - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: approved

## 1) Escopo funcional

Implementar o primeiro controle operacional de publicacao de laudos no portal. A entrega cria uma acao administrativa de liberacao no modulo de laudos, sincroniza o laudo com um registro de exame visivel ao portal e altera os endpoints do portal para listar/baixar apenas exames explicitamente liberados.

## 2) Requisitos funcionais (RF)

- RF-001: o backend deve expor `POST /api/v1/laudos/{laudo_id}/portal/liberar-clinica` para usuarios administrativos autenticados.
- RF-002: a liberacao deve exigir laudo existente, paciente vinculado e `clinic_id` preenchido.
- RF-003: ao liberar, o laudo deve assumir status `Liberado no portal`.
- RF-004: ao liberar, o backend deve criar ou atualizar um registro em `exames` vinculado ao `laudo_id`, `paciente_id` e status `Liberado no portal`.
- RF-005: a listagem do portal da clinica deve retornar apenas exames com status de portal liberado ou laudo vinculado com status de portal liberado.
- RF-006: a listagem do portal do tutor deve seguir a mesma regra de liberacao explicita.
- RF-007: o endpoint de download do portal deve negar exame que ainda nao esteja liberado, mesmo que o solicitante conheca o ID.
- RF-008: a tela `/laudos` deve exibir status `Liberado no portal` e oferecer botao para liberar laudos ainda nao publicados.
- RF-009: a tela de visualizacao de laudo deve oferecer a mesma acao antes do download/impressao, para apoiar revisao final.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (LGPD): nenhum exame deve aparecer em portal externo sem acao explicita de liberacao.
- NFR-002 (seguranca): a autorizacao por tutor/pet e clinica/unidade permanece obrigatoria alem do status de liberacao.
- NFR-003 (auditoria): a acao administrativa de liberacao deve registrar evento best-effort com laudo, exame, paciente e clinica.
- NFR-004 (compatibilidade): o login interno e o fluxo existente de geracao de PDF nao devem ser alterados.
- NFR-005 (rollout): o primeiro ciclo pode publicar metadados do exame; a persistencia definitiva do PDF/anexo no storage do portal fica como etapa posterior.

## 4) Contratos tecnicos

### API administrativa

- `POST /api/v1/laudos/{laudo_id}/portal/liberar-clinica`
  - auth:
    - token administrativo atual
  - resposta:
    - `message`
    - `laudo_id`
    - `exame_id`
    - `paciente_id`
    - `clinic_id`
    - `status`
    - `released_at`

### API portal

- `GET /api/v1/portal/clinicas/exames`
  - deve aplicar filtro de liberacao antes de filtros de busca/ordenacao.
- `GET /api/v1/portal/pets/{paciente_id}/exames`
  - deve aplicar filtro de liberacao antes de montar a resposta.
- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - deve negar exame nao liberado.

## 5) Criterios de aceitacao (CA)

- CA-001: liberar um laudo com clinica cria ou atualiza exame com status `Liberado no portal`.
- CA-002: liberar laudo sem clinica retorna erro 422 e nao cria exame.
- CA-003: portal do tutor lista apenas exames liberados para o pet escopado.
- CA-004: portal da clinica lista apenas exames liberados dentro da propria unidade.
- CA-005: download-url do portal nega exame nao liberado.
- CA-006: tela de laudos permite acionar a liberacao e atualiza o status exibido.
- CA-007: tela de visualizacao de laudo exibe estado liberado e bloqueia nova liberacao.

## 6) Fora de escopo

- Upload persistente do PDF gerado automaticamente como anexo do portal.
- Notificacao automatica da clinica ou tutor apos liberacao.
- Workflow de republicacao/retirada de laudo ja liberado.
- Separar status clinico do status de publicacao em nova coluna dedicada.
