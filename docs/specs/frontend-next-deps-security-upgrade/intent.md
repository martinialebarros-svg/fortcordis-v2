# Intent - frontend-next-deps-security-upgrade

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O frontend esta em `next 14.2.5`, versao com vulnerabilidades conhecidas reportadas por `npm audit` (incluindo risco critico em dependencia direta). Isso aumenta risco de exploracao em ambiente exposto.

## 2) Objetivo

Atualizar dependencias criticas do frontend para uma versao segura com menor risco de regressao funcional, preservando deploy automatico e estabilidade de build.

## 3) Nao objetivos

- Nao migrar para Next 16 neste ciclo.
- Nao refatorar codigo de paginas/componentes.
- Nao alterar arquitetura de CI/CD fora do necessario para manter deploy verde.

## 4) Contexto e restricoes

- Restricao tecnica: manter compatibilidade com stack atual (React 18 e rotas existentes).
- Restricao operacional: mudanca deve ser pequena e reversivel.
- Restricao de risco: preferir menor salto que elimine risco de runtime.

## 5) Impacto esperado

- Usuarios impactados: todos os usuarios web (mitigacao de risco de seguranca).
- Modulos impactados: `frontend/package.json`, `frontend/package-lock.json` e pipeline de deploy frontend.
- Risco de regressao: baixo a medio (dependencias de build e runtime web).

## 6) Riscos iniciais

- Risco 1: quebra de build/lint por mudanca de dependencia transitiva.
- Risco 2: upgrade parcial resolver runtime, mas manter alerta em devDependencies.

## 7) Perguntas abertas

- Pergunta 1: aplicar upgrade minimo seguro (linha 14.x) ou migrar para 15.x?

Resposta consolidada apos validacao:
- O upgrade 14.x reduziu risco, mas ainda deixou vulnerabilidade de runtime em `next`.
- Foi necessario migrar para `next 15.5.14` para zerar vulnerabilidades de producao mantendo estabilidade de build.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo claros.
- [x] Escopo e nao escopo registrados.
- [x] Restricoes mapeadas.
- [x] Estrategia de risco definida (15.x como menor salto que remove risco de runtime).
