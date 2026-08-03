# Plan - vivid-iq-cine-viewer

Data: 2026-08-02
Responsavel: Codex
Status: done

## 1) Sequencia de fases

- Fase 1 (SDD/parser): especificar e implementar leitura DICOM privada segura.
- Fase 2 (frontend): construir canvas, controles e estados da pagina.
- Fase 3 (integracao): adicionar menu e mensagens de prudencia clinica.
- Fase 4 (verificacao): fixture sintetica, arquivo externo real, lint e build.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Documentar escopo, privacidade e limite clinico.
- [x] T1.2 Implementar parser com limites de profundidade/elementos.
- [x] T1.3 Implementar testes com fixture sintetica.
- Criterio de conclusao: dimensoes, quadros e timestamps extraidos sem ler PII.
- Risco: variacao de firmware.
- Rollback: remover biblioteca e teste isolados.

### Fase 2

- [x] T2.1 Implementar selecao e arraste de arquivo sem extensao.
- [x] T2.2 Implementar canvas e controles temporais.
- [x] T2.3 Implementar brilho, contraste, fullscreen e captura PNG.
- Criterio de conclusao: cine real navegavel e reproduzivel.
- Risco: uso de memoria em arquivo grande.
- Rollback: remover nova rota.

### Fase 3

- [x] T3.1 Adicionar item no menu autenticado.
- [x] T3.2 Exibir privacidade local e bloqueio de medicoes.
- Criterio de conclusao: acesso descobrivel e limites claros.
- Risco: confusao com ferramenta diagnostica.
- Rollback: ocultar item e rota.

### Fase 4

- [x] T4.1 Executar teste sintetico e smoke externo.
- [x] T4.2 Executar ESLint, TypeScript e build Next.js.
- [x] T4.3 Executar `git diff --check` e guardrail SDD.
- Criterio de conclusao: evidencias registradas em `verify.md`.
- Risco: dependencias ausentes no worktree.
- Rollback: nenhuma publicacao sera realizada nesta iteracao.

## 3) Plano de testes

- Teste unitario Node para parser, pixels, timestamps e erros controlados.
- Smoke somente leitura com o arquivo real externo fornecido pelo usuario.
- ESLint direcionado e completo, TypeScript sem emissao e build de producao.
- Revisao manual da rota com o servidor local, quando disponivel.

## 4) Dependencias e bloqueios

- Navegador moderno com `File.arrayBuffer`, canvas e Fullscreen API.
- O arquivo clinico real deve continuar montado no volume externo para o smoke.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (worktree local, sem deploy).
