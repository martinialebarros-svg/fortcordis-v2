# Spec - frontend-lint-next16-ready

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: draft

## 1) Escopo

Substituir o script `lint` de `next lint` para ESLint CLI, preservando `.eslintrc.json` e validando lint/build/deploy.

## 2) Requisitos funcionais

- RF-001: `npm run lint` deve usar ESLint CLI.
- RF-002: `npm run lint` deve finalizar sem warning de deprecacao do Next lint.
- RF-003: `npm run build` deve continuar concluindo com sucesso.

## 3) NFR

- NFR-001: sem impacto funcional no frontend.
- NFR-002: mudanca reversivel por revert simples.

## 4) Criterios de aceitacao

- CA-001: script `lint` atualizado no `frontend/package.json`.
- CA-002: `npm run lint` verde.
- CA-003: `npm run build` verde.
- CA-004: deploy de stage e main verdes apos promocao.
