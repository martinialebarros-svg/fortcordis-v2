# Intent - institutional-portal-landing

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Problema atual

A home institucional da Fort Cordis ainda nao comunica bem a empresa, o valor para tutores e o modelo de acesso para clinicas parceiras. As rotas publicas de tutor e clinica existem, mas aparecem como paginas em construcao, sem orientar como o portal deve tratar dados sensiveis.

## 2) Objetivo

Criar uma landing page institucional para `fortcordis.com.br` que sirva como portal de entrada para tutores, clinicas parceiras e equipe interna. A pagina deve apresentar informacoes da Fort Cordis, dicas de saude pet e uma proposta segura e agil de acesso a exames integrada ao sistema Fort Cordis.

## 3) Nao objetivos

- Implementar autenticacao real de tutores ou clinicas parceiras nesta iteracao.
- Criar endpoints de download de exames ou migracoes de banco.
- Alterar o login administrativo existente do app Fort Cordis.
- Expor dados reais de pets, tutores, clinicas ou exames no site publico.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - A rota `/` deve continuar exibindo login administrativo em hosts nao institucionais.
  - Hosts institucionais continuam usando `frontend/lib/host-routing.ts`.
  - O site deve usar assets locais em `frontend/public`.
- Restricoes de prazo:
  - Entrega de frontend e SDD no mesmo ciclo.
- Restricoes regulatorio/operacional:
  - Acesso a exames deve respeitar LGPD, autorizacao por vinculo tutor/pet/clinica/unidade e auditoria.

## 5) Impacto esperado

- Usuarios impactados:
  - Tutores, clinicas parceiras e equipe interna.
- Modulos impactados:
  - `frontend/app/page.tsx`
  - `frontend/app/area-pacientes/page.tsx`
  - `frontend/app/clinica-parceira/page.tsx`
  - `frontend/app/layout.tsx`
  - `frontend/public/brand/fortcordis-portal-hero.jpg`
- Risco de regressao:
  - Baixo para operacao interna, desde que o fallback de login administrativo continue ativo para hosts nao institucionais.

## 6) Riscos iniciais

- Risco 1: criar expectativa de download funcional antes de existir backend autorizado.
- Risco 2: quebrar a separacao entre site institucional e app administrativo.
- Risco 3: copiar orientacao de seguranca sem deixar claro que autorizacao deve ocorrer no backend.

## 7) Perguntas abertas

- Qual provedor sera usado para MFA de tutores e clinicas: email, WhatsApp, SMS, passkey ou combinacao?
- Qual endpoint canonico do backend vai emitir URLs temporarias para laudos e anexos?
- A clinica parceira tera acesso por CNPJ/unidade, por medico responsavel ou ambos?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
