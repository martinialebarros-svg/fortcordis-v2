# Spec - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Escopo funcional

Permitir liberar no portal da clinica parceira um exame cujo laudo final foi emitido fora do Fort Cordis e anexado ao atendimento como PDF. O primeiro caso de uso e o eletrocardiograma: o arquivo PDF anexado ao exame deve ficar disponivel para download no portal, sem expor origem de software externo.

## 2) Requisitos funcionais (RF)

- RF-001: o backend deve expor acao administrativa para liberar um `Exame` vinculado a atendimento no portal.
- RF-002: a liberacao deve exigir exame existente, atendimento vinculado, paciente vinculado e clinica vinculada ao atendimento.
- RF-003: a liberacao deve exigir pelo menos um anexo PDF vinculado ao exame.
- RF-004: ao liberar, o exame deve assumir status `Liberado no portal`.
- RF-005: ao liberar, o exame deve registrar `data_resultado` como data de liberacao.
- RF-006: exames do tipo `ECG` ou variacoes devem aparecer no portal como `Eletrocardiograma`.
- RF-007: a listagem atual do portal da clinica deve exibir o exame liberado e seus anexos baixaveis pelo escopo da unidade.
- RF-008: a interface de atendimento deve exibir acao `Liberar no portal` no card do exame quando houver PDF anexado.
- RF-009: depois da liberacao, a interface deve indicar `Liberado no portal` sem exigir recarregar o atendimento.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (LGPD): nenhum exame externo deve aparecer no portal sem acao explicita de liberacao.
- NFR-002 (seguranca): o escopo por clinica/unidade permanece obrigatorio na listagem e no download do portal.
- NFR-003 (compatibilidade): o fluxo atual de upload de anexos do atendimento nao deve ser alterado.
- NFR-004 (clareza): o portal nao deve mencionar origem de software externo; o tipo exibido deve ser o nome clinico do exame.

## 4) Contratos tecnicos

### API administrativa

- `POST /api/v1/atendimentos/exames/{exame_id}/portal/liberar`
  - auth:
    - token administrativo atual
  - resposta:
    - `message`
    - `exame_id`
    - `paciente_id`
    - `atendimento_id`
    - `clinic_id`
    - `status`
    - `released_at`
    - `exame` serializado com `anexos_resultado`

### API portal

- `GET /api/v1/portal/clinicas/exames`
  - deve continuar listando exames liberados por `Exame.status = Liberado no portal`.
- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - deve continuar respeitando escopo da clinica e status liberado.

## 5) Criterios de aceitacao (CA)

- CA-001: liberar exame `ECG` com PDF anexo retorna status `Liberado no portal`.
- CA-002: exame `ECG` liberado passa a ter tipo `Eletrocardiograma`.
- CA-003: liberar exame sem PDF retorna erro 422 e nao altera o status para liberado.
- CA-004: card de exame no atendimento exibe botao `Liberar no portal` e estado `Liberado no portal`.
- CA-005: build/lint frontend passam apos incluir o novo botao.

## 6) Fora de escopo

- Integracao direta com software externo de ECG.
- Upload automatico por e-mail ou WhatsApp.
- Retirada/revogacao de exame ja liberado no portal.
