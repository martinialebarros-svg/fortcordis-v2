# Spec - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: approved

## 1) Escopo funcional

Implementar o primeiro controle operacional de publicacao de laudos no portal. A entrega cria uma acao administrativa de liberacao no modulo de laudos, sincroniza o laudo com um registro de exame visivel ao portal, persiste o PDF final como anexo baixavel e altera os endpoints do portal para listar/baixar apenas exames explicitamente liberados.

## 2) Requisitos funcionais (RF)

- RF-001: o backend deve expor `POST /api/v1/laudos/{laudo_id}/portal/liberar-clinica` para usuarios administrativos autenticados.
- RF-002: a liberacao deve exigir laudo existente, paciente vinculado e `clinic_id` preenchido.
- RF-003: ao liberar, o laudo deve assumir status `Liberado no portal`.
- RF-004: ao liberar, o backend deve criar ou atualizar um registro em `exames` vinculado ao `laudo_id`, `paciente_id` e status `Liberado no portal`.
- RF-005: ao liberar, o backend deve gerar o PDF final do laudo e persisti-lo como `AnexoAtendimento` vinculado ao `exame_id`.
- RF-006: a persistencia do PDF deve ser idempotente por `exame_id + hash`, evitando anexos duplicados quando a liberacao for repetida sem mudanca no PDF.
- RF-007: quando houver atendimento clinico associado ao exame/laudo, o anexo deve preservar esse `atendimento_id`; quando nao houver, o portal deve depender do vinculo por `exame_id`/`laudo_id`.
- RF-008: a resposta da liberacao deve retornar tambem `anexo_id`, `pdf_nome` e `pdf_tamanho`.
- RF-009: a listagem do portal da clinica deve retornar apenas exames com status de portal liberado ou laudo vinculado com status de portal liberado.
- RF-010: filtros e ordenacao por data no portal devem usar a data operacional do exame, priorizando `Laudo.data_exame`, depois `Exame.data_solicitacao` e por ultimo `Exame.data_resultado`.
- RF-011: quando a clinica informar apenas `data_inicio`, a busca deve tratar essa data como um dia unico; quando informar `data_inicio` e `data_fim`, deve buscar o periodo fechado selecionado.
- RF-012: a listagem do portal do tutor deve seguir a mesma regra de liberacao explicita e ordenacao por data operacional.
- RF-013: o endpoint de download do portal deve negar exame que ainda nao esteja liberado, mesmo que o solicitante conheca o ID.
- RF-014: a tela `/laudos` deve exibir status `Liberado no portal` e oferecer botao para liberar laudos ainda nao publicados.
- RF-015: a tela de visualizacao de laudo deve oferecer a mesma acao antes do download/impressao, para apoiar revisao final.
- RF-016: no painel da clinica, ao selecionar a data inicial vazia, a data final deve ser preenchida automaticamente com a mesma data para orientar busca de dia unico.
- RF-017: o portal deve rotular separadamente `Data de realizacao` e `Data de liberacao` nos resultados exibidos para clinicas e tutores.
- RF-018: ao liberar um laudo no portal, o backend deve tentar notificar a clinica por email usando a conta ativa da unidade, o email do convite mais recente ou o email cadastrado da clinica.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (LGPD): nenhum exame deve aparecer em portal externo sem acao explicita de liberacao.
- NFR-002 (seguranca): a autorizacao por tutor/pet e clinica/unidade permanece obrigatoria alem do status de liberacao.
- NFR-003 (auditoria): a acao administrativa de liberacao deve registrar evento best-effort com laudo, exame, anexo, paciente, clinica e metadados do PDF.
- NFR-004 (compatibilidade): o login interno e o fluxo existente de geracao de PDF nao devem ser alterados.
- NFR-005 (rollout): a liberacao deve ser transacional do ponto de vista funcional; se o PDF nao puder ser gerado/persistido, o laudo nao deve ficar publicado pela metade.
- NFR-006 (notificacao): falha no envio do email da clinica nao pode impedir a liberacao funcional do laudo no portal; o resultado do envio deve voltar no payload da acao.

## 4) Contratos tecnicos

### API administrativa

- `POST /api/v1/laudos/{laudo_id}/portal/liberar-clinica`
  - auth:
    - token administrativo atual
  - resposta:
    - `message`
    - `laudo_id`
    - `exame_id`
    - `anexo_id`
    - `paciente_id`
    - `clinic_id`
    - `status`
    - `pdf_nome`
    - `pdf_tamanho`
    - `released_at`
    - `notificacao_clinica.status`
    - `notificacao_clinica.destination_masked`
    - `notificacao_clinica.provider`
    - `notificacao_clinica.reason`

### API portal

- `GET /api/v1/portal/clinicas/exames`
  - deve aplicar filtro de liberacao antes de filtros de busca/ordenacao.
  - `data_inicio` sem `data_fim` deve filtrar somente o dia de `data_inicio`.
  - `data_inicio` e `data_fim` devem filtrar intervalo fechado por data operacional do exame.
- `GET /api/v1/portal/pets/{paciente_id}/exames`
  - deve aplicar filtro de liberacao antes de montar a resposta.
  - deve ordenar por data operacional do exame.
- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - deve negar exame nao liberado.

## 5) Criterios de aceitacao (CA)

- CA-001: liberar um laudo com clinica cria ou atualiza exame com status `Liberado no portal`.
- CA-002: liberar laudo sem clinica retorna erro 422 e nao cria exame.
- CA-003: liberar um laudo cria um anexo PDF baixavel vinculado ao exame do portal.
- CA-004: liberar novamente o mesmo PDF reutiliza o anexo existente e nao duplica arquivo no portal.
- CA-005: portal do tutor lista apenas exames liberados para o pet escopado.
- CA-006: portal da clinica lista apenas exames liberados dentro da propria unidade, incluindo o fluxo de conta ativada por convite.
- CA-007: download-url do portal nega exame nao liberado.
- CA-008: tela de laudos permite acionar a liberacao e atualiza o status exibido.
- CA-009: tela de visualizacao de laudo exibe estado liberado e bloqueia nova liberacao.
- CA-010: filtro de data da clinica encontra laudos pela data de realizacao do exame, mesmo quando a liberacao ocorreu em outro dia.
- CA-011: data inicial sem data final busca apenas aquele dia.
- CA-012: painel da clinica preenche `Ate` com a mesma data ao escolher `De` vazio, permitindo alterar depois para periodo.
- CA-013: resultados do portal exibem explicitamente `Data de realizacao` e `Data de liberacao`, evitando campo generico `Data`.
- CA-014: liberar um laudo com conta de clinica ativa retorna confirmacao de notificacao por email sem bloquear a publicacao do PDF no portal.

## 6) Fora de escopo

- Notificacao automatica do tutor apos liberacao.
- Workflow de republicacao/retirada de laudo ja liberado.
- Separar status clinico do status de publicacao em nova coluna dedicada.
