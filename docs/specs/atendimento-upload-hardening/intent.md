# Intent - atendimento-upload-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

O upload de anexos do atendimento aceita qualquer tipo de arquivo sem allowlist de extensao/MIME e faz leitura integral em memoria antes de persistir. Isso aumenta risco de seguranca operacional e pode causar pico de memoria sob concorrencia.

## 2) Objetivo

Endurecer o fluxo de upload de anexos de atendimento para aceitar apenas tipos permitidos, limitar tamanho de forma robusta e melhorar previsibilidade de erro, sem quebrar o contrato principal de uso da tela de atendimento.

## 3) Nao objetivos

- Redesenhar storage completo de anexos clinicos.
- Alterar o schema do banco para anexos.
- Reescrever o modulo inteiro `frontend/app/atendimento/page.tsx`.
- Resolver todos os temas de seguranca do projeto em uma unica entrega.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter endpoint principal `POST /api/v1/atendimentos/{id}/anexos/upload` e payload multipart atuais.
- Restricoes de prazo: feature piloto curta para validar SDD no projeto.
- Restricoes regulatorio/operacional: seguir fluxo local -> stage -> producao e evitar impacto em dados reais.

## 5) Impacto esperado

- Usuarios impactados: equipe que registra exames e anexos no atendimento.
- Modulos impactados: backend `atendimento.py` e `atendimento_upload_service.py`, frontend `atendimento/page.tsx`, testes backend.
- Risco de regressao: medio (arquivos antes aceitos podem passar a ser rejeitados).

## 6) Riscos iniciais

- Risco 1: allowlist muito restrita bloquear arquivo legitimo de uso real.
- Risco 2: validacao por MIME/extensao gerar falso positivo em navegadores que enviam `application/octet-stream`.

## 7) Perguntas abertas

- Pergunta 1: vamos aceitar apenas imagens + PDF na fase piloto, ou incluir DOC/DOCX?
- Resposta: piloto aprovado com allowlist conservadora (pdf, jpg, jpeg, png, webp), sem DOC/DOCX.
- Pergunta 2: limite de 25MB permanece unico para todos os tipos ou teremos limite por categoria?
- Resposta: manter limite unico de 25MB nesta iteracao.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
