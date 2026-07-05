# Spec - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Escopo funcional

Permitir registrar em `Laudos` um eletrocardiograma cujo PDF final foi emitido fora do Fort Cordis. O usuario deve acessar o upload pelo dropdown `Laudar`, salvar o PDF como laudo finalizado e liberar o arquivo no portal da clinica parceira pela propria listagem/tela de `Laudos`, sem expor origem de software externo.

## 2) Requisitos funcionais (RF)

- RF-001: o backend deve expor upload administrativo de PDF para criar laudo do tipo `eletrocardiograma`.
- RF-002: o upload deve aceitar contexto por `agendamento_id`, `atendimento_id`, `paciente_id` e `clinic_id`, preenchendo paciente e clinica quando possivel.
- RF-003: o upload deve aceitar apenas PDF valido e persistir o arquivo original como anexo do laudo.
- RF-004: o dropdown `Laudar` deve incluir a opcao `Eletrocardiograma` com destino para upload de PDF.
- RF-005: o laudo criado deve aparecer em `Laudos` como `Eletrocardiograma` e status `Finalizado`.
- RF-006: a liberacao pelo botao de `Laudos` deve publicar o exame como `Eletrocardiograma`.
- RF-007: a liberacao de eletrocardiograma deve reutilizar o PDF original enviado, e nao gerar outro PDF interno.
- RF-008: a listagem atual do portal da clinica deve exibir o exame liberado e seus anexos baixaveis pelo escopo da unidade.
- RF-009: a interface de atendimento nao deve exibir o botao de liberacao direta para esse fluxo.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (LGPD): nenhum exame externo deve aparecer no portal sem acao explicita de liberacao.
- NFR-002 (seguranca): o escopo por clinica/unidade permanece obrigatorio na listagem e no download do portal.
- NFR-003 (compatibilidade): o fluxo atual de upload de anexos do atendimento nao deve ser alterado.
- NFR-004 (clareza): o portal nao deve mencionar origem de software externo; o tipo exibido deve ser o nome clinico do exame.

## 4) Contratos tecnicos

### API administrativa

- `POST /api/v1/laudos/eletrocardiograma/upload-pdf`
  - auth:
    - token administrativo atual
  - multipart:
    - `arquivo`
    - `agendamento_id`
    - `atendimento_id`
    - `paciente_id`
    - `clinic_id`
    - `data_exame`
  - resposta:
    - `id`
    - `tipo`
    - `titulo`
    - `status`
    - `paciente_id`
    - `clinic_id`
    - `agendamento_id`
    - `anexo_id`

- `GET /api/v1/laudos/{laudo_id}/pdf-original`
  - faz download do PDF externo anexado ao laudo.

- `POST /api/v1/laudos/{laudo_id}/portal/liberar-clinica`
  - deve reutilizar o PDF externo quando o laudo tiver `eletrocardiograma_pdf`.

### API portal

- `GET /api/v1/portal/clinicas/exames`
  - deve continuar listando exames liberados por `Exame.status = Liberado no portal`.
- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - deve continuar respeitando escopo da clinica e status liberado.

## 5) Criterios de aceitacao (CA)

- CA-001: dropdown `Laudar` exibe `Eletrocardiograma` e leva ao upload de PDF.
- CA-002: upload de PDF cria laudo `eletrocardiograma` finalizado.
- CA-003: `Laudos` baixa o PDF original do eletrocardiograma.
- CA-004: liberacao pelo botao em `Laudos` publica exame `Eletrocardiograma` com o anexo original.
- CA-005: card de exame do atendimento nao exibe mais acao direta de liberacao para portal.
- CA-006: build/lint frontend e testes backend passam.

## 6) Fora de escopo

- Integracao direta com software externo de ECG.
- Upload automatico por e-mail ou WhatsApp.
- Retirada/revogacao de exame ja liberado no portal.
