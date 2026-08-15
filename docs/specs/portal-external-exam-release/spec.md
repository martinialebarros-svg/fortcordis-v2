# Spec - portal-external-exam-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: in-progress

## 1) Escopo funcional

Permitir registrar em `Laudos` um eletrocardiograma cujo PDF final foi emitido fora do Fort Cordis. O usuario deve acessar o upload pelo dropdown `Laudar`, salvar o PDF como laudo finalizado, corrigir o arquivo anexado quando necessario e liberar o arquivo no portal da clinica parceira pela propria listagem/tela de `Laudos`, sem expor origem de software externo.

## 2) Requisitos funcionais (RF)

- RF-001: o backend deve expor upload administrativo de PDF para criar laudo do tipo `eletrocardiograma`.
- RF-002: o upload deve aceitar contexto por `agendamento_id`, `atendimento_id`, `paciente_id` e `clinic_id`, preenchendo paciente e clinica quando possivel.
- RF-003: o upload deve aceitar apenas PDF valido e persistir o arquivo original como anexo do laudo.
- RF-004: os pontos de entrada administrativos para laudo devem incluir a opcao `Eletrocardiograma` com destino para upload de PDF, tanto no dropdown `Laudar` da agenda quanto no menu `Novo Laudo` da Central de laudos.
- RF-005: o laudo criado deve aparecer em `Laudos` como `Eletrocardiograma` e status `Finalizado`.
- RF-006: a liberacao pelo botao de `Laudos` deve publicar o exame como `Eletrocardiograma`.
- RF-007: a liberacao de eletrocardiograma deve reutilizar o PDF original enviado, e nao gerar outro PDF interno.
- RF-008: a listagem atual do portal da clinica deve exibir o exame liberado e seus anexos baixaveis pelo escopo da unidade.
- RF-009: a interface de atendimento nao deve exibir o botao de liberacao direta para esse fluxo.
- RF-010: a tela do laudo de `Eletrocardiograma` deve permitir substituir o PDF anexado sem criar um novo laudo.
- RF-011: quando o laudo de eletrocardiograma ja estiver liberado no portal, a substituicao deve atualizar o mesmo arquivo baixavel da clinica parceira.
- RF-012: a substituicao do PDF deve registrar auditoria com metadados do arquivo anterior e do novo arquivo.
- RF-013: quando o upload for aberto sem `agendamento_id` e sem `atendimento_id`, a tela deve operar em modo de telemedicina, permitindo escolher a clinica parceira manualmente.
- RF-014: no modo de telemedicina, a tela deve permitir buscar paciente ja cadastrado por nome do pet ou do tutor sem sair do fluxo.
- RF-015: no modo de telemedicina, a tela deve oferecer cadastro rapido de tutor e pet no mesmo formulario quando o paciente ainda nao existir.
- RF-016: ao concluir o cadastro rapido no mesmo fluxo, o upload deve continuar usando o `paciente_id` criado, sem exigir reabertura da tela.
- RF-017: no modo sem agendamento, o frontend deve exigir clinica parceira e paciente selecionado ou cadastrado antes de aceitar o envio do PDF.
- RF-018: o menu `Novo Laudo` da Central de laudos deve abrir inteiro sobre o restante da tela, sem clipping pelo cabeçalho decorativo.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (LGPD): nenhum exame externo deve aparecer no portal sem acao explicita de liberacao.
- NFR-002 (seguranca): o escopo por clinica/unidade permanece obrigatorio na listagem e no download do portal.
- NFR-003 (compatibilidade): o fluxo atual de upload de anexos do atendimento nao deve ser alterado.
- NFR-004 (clareza): o portal nao deve mencionar origem de software externo; o tipo exibido deve ser o nome clinico do exame.
- NFR-005 (operacao): o cadastro rapido deve reaproveitar os endpoints existentes de pacientes/tutores, evitando uma segunda fonte de verdade para cadastro.

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

- `POST /api/v1/pacientes`
  - auth:
    - token administrativo atual
  - json:
    - `nome`
    - `tutor`
    - `tutor_email`
    - `tutor_telefone`
    - `tutor_whatsapp`
    - `especie`
    - `raca`
    - `sexo`
    - `peso_kg`
    - `data_nascimento`
    - `microchip`
  - comportamento:
    - pode ser chamado pelo fluxo de upload de eletrocardiograma sem agendamento para criar tutor e pet antes do envio do PDF.

- `GET /api/v1/laudos/{laudo_id}/pdf-original`
  - faz download do PDF externo anexado ao laudo.

- `PUT /api/v1/laudos/{laudo_id}/eletrocardiograma/pdf`
  - auth:
    - token administrativo atual
  - multipart:
    - `arquivo`
  - comportamento:
    - substitui o PDF externo referenciado no laudo.
    - se o laudo ja estiver liberado no portal, reutiliza o mesmo anexo/publicacao para a clinica.
  - resposta:
    - `laudo_id`
    - `anexo_id`
    - `exame_id`
    - `status`
    - `pdf_nome`
    - `pdf_tamanho`
    - `liberado_no_portal`

- `POST /api/v1/laudos/{laudo_id}/portal/liberar-clinica`
  - deve reutilizar o PDF externo quando o laudo tiver `eletrocardiograma_pdf`.

### API portal

- `GET /api/v1/portal/clinicas/exames`
  - deve continuar listando exames liberados por `Exame.status = Liberado no portal`.
- `POST /api/v1/portal/exames/{exame_id}/download-url`
  - deve continuar respeitando escopo da clinica e status liberado.

## 5) Criterios de aceitacao (CA)

- CA-001: dropdown `Laudar` da agenda e menu `Novo Laudo` da Central de laudos exibem `Eletrocardiograma` e levam ao upload de PDF.
- CA-002: upload de PDF cria laudo `eletrocardiograma` finalizado.
- CA-003: `Laudos` baixa o PDF original do eletrocardiograma.
- CA-004: liberacao pelo botao em `Laudos` publica exame `Eletrocardiograma` com o anexo original.
- CA-005: card de exame do atendimento nao exibe mais acao direta de liberacao para portal.
- CA-006: a tela do laudo permite substituir o PDF do eletrocardiograma e manter o mesmo registro do laudo.
- CA-007: se o laudo ja estiver no portal, a substituicao atualiza o arquivo baixavel da clinica sem criar outro laudo.
- CA-008: build/lint frontend e testes backend passam.
- CA-009: no fluxo sem agendamento, o operador consegue selecionar a clinica manualmente antes do upload.
- CA-010: no fluxo sem agendamento, a busca de paciente encontra pets ja cadastrados por nome do pet ou do tutor.
- CA-011: quando o paciente ainda nao existir, o operador consegue cadastrar tutor e pet no mesmo fluxo e seguir com o upload do PDF.
- CA-012: o envio do PDF continua usando o paciente criado no mesmo fluxo, sem precisar sair para `Pacientes`.
- CA-013: ao abrir `Novo Laudo` na Central de laudos, as opcoes do menu ficam totalmente visiveis e clicaveis.

## 6) Fora de escopo

- Integracao direta com software externo de ECG.
- Upload automatico por e-mail ou WhatsApp.
- Retirada/revogacao de exame ja liberado no portal.
