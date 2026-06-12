# Intent - prod-cost-baseline-collector

Data: 2026-06-09  
Responsavel: Martiniano + Codex  
Status: done

## 1) Problema atual

Apos deploy em producao, a operacao precisava consultar rapidamente o baseline de custos/quotas de Google Maps e readiness de hardening sem versionar snapshots sensiveis ou depender de coleta manual repetitiva.

## 2) Objetivo

Versionar um coletor operacional simples para gerar artefatos locais de baseline pos-deploy em producao, mantendo os resultados fora do Git e permitindo comparacoes futuras sem custo de desenvolvimento adicional.

## 3) Nao objetivos

- Nao criar novo endpoint de backend.
- Nao versionar dados coletados em producao.
- Nao alterar regras de agenda, logistica ou faturamento.
- Nao automatizar a coleta em CI/CD neste ciclo.

## 4) Contexto e restricoes

- O script deve funcionar com a biblioteca padrao do Python.
- A saida operacional deve permanecer em `ops/baseline/prod/`, ignorada pelo Git.
- A autenticacao precisa aceitar bearer token direto, login explicito ou fallback de token interno local.
- O ciclo precisa passar pelo guardrail SDD antes de deploy.

## 5) Impacto esperado

- Usuarios impactados: operadores tecnicos e responsaveis por deploy.
- Modulos impactados: scripts operacionais e regra de ignore para artefatos locais.
- Risco de regressao: baixo, pois nao altera runtime da aplicacao.

## 6) Riscos iniciais

- Coletas podem conter dados operacionais sensiveis se forem versionadas por engano.
- Falhas de credencial ou conectividade podem impedir a coleta em janela de pos-deploy.

## 7) Perguntas abertas

- O baseline devera virar uma rotina automatizada em uma fase futura?
- Qual periodo de retencao local deve ser adotado para snapshots operacionais?

## 8) Definition of Ready

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
