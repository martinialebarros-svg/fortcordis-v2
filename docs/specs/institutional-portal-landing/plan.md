# Plan - institutional-portal-landing

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Sequencia de fases

- Fase 1 (asset/estrutura): gerar e salvar asset visual local para o hero institucional.
- Fase 2 (frontend/home): recriar `/` institucional mantendo fallback de login.
- Fase 3 (frontend/portais): substituir placeholders de tutor e clinica parceira.
- Fase 4 (validacao): executar build e verificacao visual local.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Gerar imagem hero sem texto, logo, dados sensiveis ou watermark.
- [x] T1.2 Salvar imagem otimizada em `frontend/public/brand/fortcordis-portal-hero.jpg`.
- Criterio de conclusao:
  - Asset local carregavel pelo Next.js.
- Risco:
  - Arquivo pesado ou imagem com elementos inadequados.
- Rollback:
  - Remover asset e referencia no hero.

### Fase 2

- [x] T2.1 Recriar `frontend/app/page.tsx` com hero, portais, dicas, seguranca e integracao.
- [x] T2.2 Preservar `LoginPageClient` para hosts nao institucionais.
- Criterio de conclusao:
  - Conteudo institucional aparece apenas em host institucional.
- Risco:
  - Quebrar login administrativo local.
- Rollback:
  - Reverter `frontend/app/page.tsx`.

### Fase 3

- [x] T3.1 Substituir placeholder de `/area-pacientes`.
- [x] T3.2 Substituir placeholder de `/clinica-parceira`.
- [x] T3.3 Atualizar metadata global do site.
- Criterio de conclusao:
  - Rotas publicas comunicam proposta de acesso sem simular downloads.
- Risco:
  - Copy prometer funcionalidade backend ainda inexistente.
- Rollback:
  - Reverter paginas de portal.

### Fase 4

- [x] T4.1 Executar `npm run build`.
- [x] T4.2 Abrir site local e verificar desktop/mobile.
- Criterio de conclusao:
  - Build e QA visual sem bloqueios.
- Risco:
  - Falhas por dependencias ou restricao de fontes externas.
- Rollback:
  - Ajustar UI/codigo ou registrar bloqueio.

## 3) Plano de testes

- Testes unitarios:
  - Nao aplicavel nesta iteracao, pois a entrega e conteudo/rotas estaticas.
- Testes de integracao:
  - `npm run build`.
- Testes manuais:
  - Verificar `/` com host institucional.
  - Verificar `/` em localhost.
  - Verificar `/area-pacientes`.
  - Verificar `/clinica-parceira`.
  - Verificar desktop e mobile.

## 4) Dependencias e bloqueios

- Dependencia 1:
  - Backend futuro para magic link, MFA, autorizacao e signed URLs.
- Dependencia 2:
  - Definicao operacional de canal de MFA e responsavel por convites de clinicas.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local).
