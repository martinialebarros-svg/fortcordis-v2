# Intent - sdd-guardrail-ci

Data: 2026-04-12  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

Mudancas de codigo podem ser promovidas sem artefatos SDD completos, reduzindo rastreabilidade e aumentando risco de regressao.

## 2) Objetivo

Forcar o fluxo SDD no CI para que toda mudanca de codigo relevante seja acompanhada de `spec.md` e `verify.md` em `docs/specs/<feature>/`, com estrutura completa da feature.

## 3) Nao objetivos

- Nao bloquear mudancas apenas documentais.
- Nao substituir revisao tecnica humana.
- Nao impor aprovacao automatica de qualidade de codigo.

## 4) Restricoes

- Integracao deve ser compativel com deploy atual para `stage` e `main`.
- Implementacao sem dependencias externas.
