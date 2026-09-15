# Plan - atendimento-anexo-pdf-preview-csp

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel.
- Fase 3 (frontend): adicionar `frame-src 'self' blob:` na CSP.
- Fase 4 (integracao/observabilidade): validar header HTTP e comportamento
  real do `<iframe>` no navegador.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Adicionar `"frame-src 'self' blob:"` a
  `appContentSecurityPolicy` em `frontend/next.config.js`.
- Criterio de conclusao: linha adicionada, demais diretivas inalteradas.
- Risco: baixo.
- Rollback: remover a linha.

### Fase 4

- [x] T4.1 Subir o dev server local e confirmar via `curl -D -` que o
  header `Content-Security-Policy` inclui `frame-src 'self' blob:`.
- [x] T4.2 No navegador, criar um Blob PDF, gerar uma `blob:` URL de mesma
  origem e injetar um `<iframe>` apontando para ela; confirmar ausencia de
  erro de CSP no console (reproduz o mecanismo exato do bug original).
- Criterio de conclusao: header presente e iframe carrega sem violacao de
  CSP.
- Risco: baixo.
- Rollback: nao aplicavel (apenas verificacao).

## 3) Plano de testes

- Testes unitarios: nao aplicavel (mudanca e config estatica, sem logica).
- Testes de integracao: nao aplicavel.
- Testes manuais: verificacao do header via `curl` + reproducao do
  framing de `blob:` no navegador (ver `verify.md`).

## 4) Dependencias e bloqueios

Nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (dev server local, porta 3002).
