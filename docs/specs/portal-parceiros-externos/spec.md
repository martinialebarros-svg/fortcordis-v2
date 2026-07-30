# Spec - portal-parceiros-externos

Data: 2026-07-30  
Responsavel: Codex  
Status: in_progress

## 1) Escopo funcional

Esta entrega generaliza o portal externo da Fort Cordis para operar como portal de parceiros, mantendo o comportamento atual de clinicas parceiras e adicionando suporte nativo a veterinarios parceiros volantes. O sistema deve permitir cadastrar parceiro externo, definir seu tipo, convidar para acesso, autenticar com o mesmo fluxo de seguranca do portal e exibir apenas os exames e laudos liberados para aquele parceiro. A gestao administrativa tambem deve mostrar, em uma visao unificada, clinicas e veterinarios parceiros com status de convite, cadastro, acesso e download.

## 2) Requisitos funcionais (RF)

- RF-001: o sistema deve suportar o conceito de `parceiro externo` com os tipos `clinica` e `veterinario`.
- RF-002: o perfil `clinica` deve continuar operando com os comportamentos atuais do portal, sem quebra para contas ja ativadas.
- RF-003: o perfil `veterinario` deve poder ser cadastrado sem endereco fixo completo, exigindo ao menos nome, contato profissional, email de login e cidade/estado base.
- RF-004: o parceiro externo deve receber convite individual para criacao/confirmacao de senha e acesso ao portal.
- RF-005: a autenticacao do portal deve ser unificada por parceiro externo, preservando auditoria de ativacao, login, sessao e download.
- RF-006: a liberacao de laudo no portal deve aceitar destinatario(s) explicito(s), incluindo clinica parceira, veterinario parceiro e tutor, de forma independente ou combinada.
- RF-007: o parceiro externo autenticado deve visualizar apenas os laudos, anexos e exames explicitamente liberados para o seu perfil.
- RF-008: o ambiente autenticado deve identificar claramente o tipo do parceiro, exibindo rótulo explicito como `Ambiente da clinica parceira` ou `Ambiente do veterinario parceiro`.
- RF-009: a tela administrativa de gestao do portal deve listar parceiros externos com filtros por tipo, status de convite, status de cadastro, ultimo acesso, ultimo download e primeira utilizacao.
- RF-010: a administracao deve permitir reenviar convite, revogar acesso, redefinir senha e acompanhar historico por parceiro externo.
- RF-011: o fluxo de vinculacao de exames/laudos deve permitir apontar a origem externa do caso para um parceiro externo quando o encaminhamento vier de clinica ou veterinario.
- RF-012: o fluxo sem agendamento previo, como telemedicina ou upload de eletrocardiograma, deve aceitar selecao de parceiro externo existente ou cadastro rapido de novo parceiro antes da liberacao do laudo.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a listagem administrativa do portal deve suportar filtros por tipo, status e uso recente sem degradar perceptivelmente a operacao usual de laudos.
- NFR-002 (seguranca/permissoes): toda consulta do portal autenticado deve ser escopada por destinatario explicito do laudo/exame, sem heranca implicita por email ou por cidade.
- NFR-003 (observabilidade): convites, ativacoes, logins, revogacoes, downloads e erros de entrega devem gerar eventos auditaveis por parceiro externo.
- NFR-004 (compatibilidade): parceiros do tipo `clinica` ja existentes devem continuar acessando o portal sem necessidade de novo cadastro manual.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /api/v1/portal/parceiros`
  - Metodo: `GET`
  - Payload: filtros opcionais por `tipo`, `status_convite`, `status_conta`, `sem_acesso_ha_dias`, `ja_baixou_laudo`
  - Resposta: lista paginada de parceiros externos com metricas resumidas

- Endpoint: `POST /api/v1/portal/parceiros`
  - Metodo: `POST`
  - Payload:
    - `tipo`
    - `nome_exibicao`
    - `email_login`
    - `telefone` / `whatsapp`
    - `cidade_base`
    - `estado_base`
    - `clinica_id` opcional quando `tipo=clinica`
    - `crmv`, `cpf`, `observacoes`, `area_atuacao` opcionais quando `tipo=veterinario`
  - Resposta: parceiro externo criado

- Endpoint: `PATCH /api/v1/portal/parceiros/{id}`
  - Metodo: `PATCH`
  - Payload: atualizacao parcial de dados cadastrais e status
  - Resposta: parceiro externo atualizado

- Endpoint: `POST /api/v1/portal/parceiros/{id}/convites`
  - Metodo: `POST`
  - Payload: canal, validade, mensagem opcional e politica de reenvio
  - Resposta: convite criado/reenviado com metadados de expiracao

- Endpoint: `GET /api/v1/portal/parceiros/convites/{token}`
  - Metodo: `GET`
  - Payload: sem corpo
  - Resposta: status do convite do veterinario parceiro, expiracao e email mascarado

- Endpoint: `POST /api/v1/portal/parceiros/ativacao`
  - Metodo: `POST`
  - Payload:
    - `invite_token`
    - `responsavel_nome`
    - `password`
    - `password_confirmation`
  - Resposta: sessao autenticada do parceiro com refresh opcional

- Endpoint: `POST /api/v1/portal/parceiros/auth/login`
  - Metodo: `POST`
  - Payload: `email`, `password`, `remember_device_until_shift_end`
  - Resposta: sessao autenticada ou desafio MFA por email

- Endpoint: `POST /api/v1/portal/parceiros/auth/mfa/verificar`
  - Metodo: `POST`
  - Payload: `challenge_id`, `codigo`, `remember_device_until_shift_end`
  - Resposta: sessao autenticada do parceiro

- Endpoint: `POST /api/v1/portal/parceiros/auth/refresh`
  - Metodo: `POST`
  - Payload: sem corpo
  - Resposta: renovacao da sessao via cookie httpOnly dedicado do parceiro

- Endpoint: `POST /api/v1/portal/parceiros/auth/logout`
  - Metodo: `POST`
  - Payload: sem corpo
  - Resposta: encerramento da sessao e invalidacao do refresh cookie

- Endpoint: `POST /api/v1/portal/parceiros/auth/esqueci-senha`
  - Metodo: `POST`
  - Payload: `email`
  - Resposta: aceite generico da solicitacao

- Endpoint: `POST /api/v1/portal/parceiros/auth/redefinir-senha`
  - Metodo: `POST`
  - Payload: `reset_token`, `password`, `password_confirmation`
  - Resposta: confirmacao da troca de senha

- Endpoint: `GET /api/v1/portal/parceiros/{id}/timeline`
  - Metodo: `GET`
  - Payload: sem corpo
  - Resposta: linha do tempo com convites, ativacoes, resets, revogacoes, acessos e downloads

- Endpoint: `POST /api/v1/laudos/{id}/portal-destinatarios`
  - Metodo: `POST`
  - Payload:
    - `destinatarios`: lista com itens do tipo `parceiro` ou `tutor`
    - `partner_id` quando `tipo=parceiro`
    - `permitir_download`
    - `notificar_por_email`
  - Resposta: destinatarios liberados/revogados para o laudo

- Endpoint: `GET /api/v1/portal/parceiros/exames`
  - Metodo: `GET`
  - Payload: filtros por pet, tutor, tipo de exame, data de realizacao, data de liberacao, status
  - Resposta: lista escopada ao parceiro autenticado

### Entrega atual da fase 2

- foram implementados os endpoints administrativos iniciais:
  - `GET /api/v1/portal/parceiros`
  - `POST /api/v1/portal/parceiros`
  - `PATCH /api/v1/portal/parceiros/{id}`
- o cadastro do tipo `veterinario` valida email de login, cidade/estado base e ao menos um contato profissional
- o cadastro do tipo `clinica` reaproveita automaticamente os dados da clinica operacional vinculada quando o payload nao informar nome, contato ou localizacao
- a API ja protege dois conflitos importantes:
  - mesma clinica sendo vinculada duas vezes
  - mesmo email de login ativo sendo reutilizado por outro parceiro externo
- convites, timeline, autenticacao generica e liberacao multi-destinatario continuam nas proximas fases

### Entrega atual da fase 3

- foi adicionada a tela administrativa `frontend/app/clinicas/portal/parceiros/page.tsx`
- a tela permite:
  - listar parceiros externos por tipo e status
  - buscar por nome, email, cidade ou clinica vinculada
  - cadastrar veterinario parceiro pela interface
  - vincular clinica operacional ao novo modelo de parceiro externo
  - editar parceiros ja existentes
  - alternar ativo/inativo sem sair da listagem
- a tela atual foi conectada ao fluxo ja conhecido do portal por um atalho em `frontend/app/clinicas/portal/page.tsx`
- o fluxo visual desta fase ainda e administrativo; convites, timeline de parceiro e autenticacao dedicada do veterinario parceiro seguem como proximas entregas

### Entrega atual da fase 4

- foi implementado o fluxo dedicado de convite, ativacao, login, refresh, logout e redefinicao de senha para `veterinario parceiro`
- a autenticacao do parceiro reutiliza o mesmo padrao de seguranca do portal:
  - senha propia
  - cookie httpOnly de refresh dedicado
  - MFA adicional por email quando o backend exigir
  - auditoria de convite, ativacao, login, refresh e reset
- o painel administrativo de parceiros agora permite gerar convite individual para veterinario parceiro ativo, com:
  - link pronto
  - mensagem pronta para WhatsApp
  - atalho para abrir o WhatsApp da operacao
- foi adicionada a experiencia publica do parceiro em:
  - `frontend/app/veterinario-parceiro/page.tsx`
  - `frontend/app/veterinario-parceiro/ativar/[token]/page.tsx`
  - `frontend/app/veterinario-parceiro/redefinir-senha/page.tsx`
- o ambiente autenticado do parceiro mostra apenas os exames explicitamente liberados em `portal_partner_release_targets`
- a listagem autenticada do parceiro suporta:
  - busca geral
  - filtros por pet, tutor, especie, tipo de exame e periodo
  - ordenacao por realizacao, pet, tutor ou tipo
  - download protegido dos anexos liberados

### Banco/migracoes

- Tabelas/colunas afetadas:
  - nova tabela `portal_partner_profiles`
    - `id`
    - `tipo` (`clinica` | `veterinario`)
    - `clinica_id` nullable, para vincular parceiros do tipo clinica a um cadastro operacional ja existente
    - `nome_exibicao`
    - `email_login`
    - `telefone`
    - `whatsapp`
    - `cidade_base`
    - `estado_base`
    - `crmv`
    - `cpf_documento`
    - `area_atuacao`
    - `observacoes`
    - `ativo`
    - `created_at`
    - `updated_at`
  - generalizacao das estruturas de autenticacao/convite/sessao do portal para referenciar `portal_partner_profiles.id` em vez de fluxo exclusivo de clinica
  - nova tabela `portal_partner_release_targets` para mapear laudos/exames liberados por destinatario externo
  - campos opcionais de vinculacao a parceiro externo no fluxo de origem do exame/laudo, incluindo cenarios com e sem agendamento
- Indices/constraints:
  - indice por `tipo`, `ativo`, `email_login`
  - unique parcial para `email_login` ativo por parceiro externo na fase 1
  - indice por `partner_id + released_at`
  - foreign keys explicitas para laudo/exame/parceiro
- Migracao necessaria: sim

### Entrega atual da fase 1

- esta rodada entrega a base de dados inicial e o backfill compativel para o conceito de parceiro externo
- foram adicionadas as tabelas `portal_partner_profiles` e `portal_partner_release_targets`
- clinicas ja existentes passam a ser espelhadas em `portal_partner_profiles` usando prioridade de email:
  - conta ativa do portal da clinica
  - email armazenado no contexto do convite legado
  - email do cadastro operacional da clinica
- exames legados com status `Liberado no portal` passam a gerar espelho em `portal_partner_release_targets`
- a generalizacao completa de convites, contas, sessoes e endpoints para `partner_id` continua nas proximas fases

### Frontend

- Telas afetadas:
  - gestao do portal administrativo
  - formulario de convite/envio de acesso
  - tela autenticada do parceiro externo
  - fluxo de liberacao de laudos
  - fluxo de upload/telemedicina sem agendamento
- Estados de UI:
  - alternancia por tipo `clinica` / `veterinario`
  - parceiro sem convite
  - convite pendente
  - cadastro concluido
  - acesso revogado
  - nenhum laudo liberado
  - timeline com eventos
- Regras de exibicao/erro:
  - formularios de parceiro veterinario nao devem exigir endereco fixo completo
  - formularios de parceiro clinica podem reaproveitar o vinculo com `clinica_id`
  - a UI deve mostrar claramente o tipo do parceiro em listas, filtros e cabecalho do portal
  - quando o email ja estiver em uso por outro parceiro externo ativo, a UI deve orientar ajuste do cadastro, sem ambiguidade

## 5) Compatibilidade e rollout

- Backward compatibility:
  - perfis atuais de clinicas parceiras devem ser migrados/espelhados para `portal_partner_profiles` sem exigir nova ativacao
  - endpoints legados de clinica parceira podem ser mantidos temporariamente como facade para a nova camada generica
- Entrega atual:
  - nesta fase nao houve troca do contrato de autenticacao do portal em producao; a entrega ficou restrita a estrutura de dados e migracao de base
- Feature flag (se houver):
  - opcional `ENABLE_PORTAL_PARTNER_TYPES`, inicialmente ativa em stage
- Estrategia de rollback:
  - manter leituras legadas para clinicas enquanto a camada generica e validada
  - se houver regressao, desativar o cadastro e convite de veterinario parceiro e preservar a operacao das clinicas

## 6) Criterios de aceitacao (CA)

- CA-001: o admin consegue cadastrar um veterinario parceiro sem endereco fixo completo, gerar convite e visualizar seu status no painel do portal.
- CA-002: uma clinica parceira ja existente continua acessando o portal normalmente apos a generalizacao para parceiro externo.
- CA-003: um veterinario parceiro autenticado visualiza apenas os laudos e exames explicitamente liberados para ele.
- CA-004: a liberacao de laudo permite selecionar clinica parceira, veterinario parceiro e tutor como destinatarios independentes.
- CA-005: o fluxo de upload/telemedicina sem agendamento permite selecionar parceiro externo existente ou cadastrar novo parceiro antes da publicacao do laudo.
- CA-006: a tela administrativa do portal exibe filtros e indicadores separados por tipo de parceiro, com ultimo acesso, ultimo download e situacao do convite.
- CA-007: a timeline do parceiro externo registra convites, ativacao, login, redefinicao de senha, revogacao e downloads.

## 7) Casos de borda

- CB-001: se o mesmo email ja estiver vinculado a outro parceiro externo ativo, o sistema deve bloquear a criacao automatica e exigir decisao administrativa explicita.
- CB-002: um veterinario parceiro sem CRMV informado pode ser salvo apenas se a Fort Cordis optar por tratar o campo como opcional nesta fase; caso contrario, a validacao deve ser consistente na UI e na API.
- CB-003: revogar um destinatario externo apos download nao apaga o historico auditavel do acesso ja realizado.
- CB-004: um laudo pode ser liberado para mais de um destinatario externo sem que um herde o escopo do outro.
- CB-005: parceiros do tipo clinica migrados do modelo anterior nao devem perder senha, convite aceito ou historico de download.

## 8) Fora de escopo

- Multiusuario por parceiro externo com perfis internos e hierarquia de equipe.
- Financeiro dedicado para veterinario parceiro dentro do portal nesta fase.
- Agenda/logistica especifica do veterinario volante dentro deste mesmo ciclo.
- Login unico compartilhando simultaneamente mais de um perfil externo com troca de contexto na mesma sessao.
