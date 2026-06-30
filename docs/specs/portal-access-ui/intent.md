# Intent - portal-access-ui

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Problema atual

O backend do portal seguro ja oferece desafio temporario, verificacao de codigo, listagem de exames e download autenticado. As paginas publicas de tutor e clinica parceira, porem, ainda nao consomem esses endpoints, o que impede validar a experiencia ponta a ponta do portal institucional.

## 2) Objetivo

Conectar o frontend institucional do portal Fort Cordis aos endpoints seguros ja criados no backend. Esta iteracao deve permitir:
- solicitar codigo temporario como tutor;
- solicitar codigo temporario como clinica parceira;
- validar a sessao do portal com codigo curto;
- listar exames autorizados;
- disparar download autenticado dos anexos liberados.

## 3) Nao objetivos

- Enviar codigo real por provider externo.
- Criar cadastro nominal persistente para usuarios de clinicas.
- Misturar sessao do portal com o login administrativo interno.
- Criar dashboard administrativo novo para suporte ao portal.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - Reusar os endpoints `/api/v1/portal` sem depender do `axios` administrativo atual.
  - Persistir a sessao do portal apenas no navegador e separada por perfil de acesso.
  - Manter o login administrativo e os cookies internos sem alteracao.
- Restricoes de prazo:
  - Entregar UI funcional, SDD e validacao local na mesma iteracao.
- Restricoes regulatorio/operacional:
  - Continuar evitando anexos em notificacoes.
  - Manter linguagem coerente com LGPD, escopo minimo e auditoria.

## 5) Impacto esperado

- Usuarios impactados:
  - Tutores e clinicas parceiras em ambiente institucional/local.
- Modulos impactados:
  - `frontend/app/area-pacientes/page.tsx`
  - `frontend/app/clinica-parceira/page.tsx`
  - `frontend/components/portal`
  - `frontend/lib/portal-api.ts`
- Risco de regressao:
  - Baixo para o app administrativo, desde que a integracao continue isolada das rotas e do storage de auth interno.

## 6) Riscos iniciais

- Risco 1: a UI reaproveitar storage do app administrativo e causar logout ou conflito de sessao.
- Risco 2: tutor e clinica conseguirem navegar, mas falharem no download por uso incorreto do token curto.
- Risco 3: validacao parcial da UX mascarar erro de build ou de rota proxy para o backend.

## 7) Perguntas abertas

- O tutor final vai entrar apenas por ID + contato ou tambem por protocolo/CPF em iteracao futura?
- A clinica parceira precisara filtrar por mais de uma unidade no mesmo login?
- Havera preview inline de PDF/imagem no portal ou somente download?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
