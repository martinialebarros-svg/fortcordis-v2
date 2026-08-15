# Intent - portal-secure-access-foundation

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Problema atual

O site institucional agora descreve um portal seguro para tutores e clinicas parceiras, mas o backend ainda nao oferece o fluxo minimo para autenticar esse acesso, limitar o escopo por tutor/pet ou clinica/unidade e baixar anexos clinicos de forma auditavel.

## 2) Objetivo

Criar a fundacao backend do portal seguro da Fort Cordis. Esta iteracao deve permitir:
- solicitar desafio temporario para tutor ou clinica parceira;
- validar codigo temporario e emitir token de sessao escopado;
- listar exames de um pet respeitando ACL por tutor ou clinica;
- expor download autenticado para anexos ja associados a exames.

## 3) Nao objetivos

- Envio real de magic link, email, SMS ou WhatsApp nesta iteracao.
- Cadastro completo de usuarios nominais de clinicas parceiras.
- UI final dos fluxos de login no frontend.
- Signed URLs em storage externo ou R2.
- RLS Supabase para o portal.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - Reaproveitar JWT, session patterns e auditoria existentes no backend.
  - Evitar credenciais em query string para download.
  - Reusar anexos clinicos existentes em `anexos_atendimentos`.
- Restricoes de prazo:
  - Entregar base funcional e testada, sem tentar fechar todos os fluxos futuros do portal.
- Restricoes regulatorio/operacional:
  - Respeitar LGPD, escopo minimo necessario e trilha de auditoria.

## 5) Impacto esperado

- Usuarios impactados:
  - Tutores e clinicas parceiras em fase futura de integracao.
- Modulos impactados:
  - `backend/app/core`
  - `backend/app/api/v1/endpoints`
  - `backend/app/models`
  - `backend/app/schemas`
  - `backend/migrations`
- Risco de regressao:
  - Baixo para o app administrativo existente, desde que a autenticacao interna atual nao seja alterada.

## 6) Riscos iniciais

- Risco 1: vazar enumeracao de tutores/clinicas se o endpoint de solicitacao responder de forma diferente para match e mismatch.
- Risco 2: liberar download de anexo sem validar escopo do exame.
- Risco 3: misturar token do portal com token administrativo.

## 7) Perguntas abertas

- Qual canal padrao de entrega sera priorizado para tutor: email, WhatsApp ou ambos?
- A clinica parceira tera modelo definitivo por usuario nominal vinculado a unidade ou por convites temporarios?
- O portal deve expor apenas anexos de exames ou tambem PDFs gerados de atendimento?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
