# Intent - deploy-authenticated-canary-smoke

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O deploy ja valida health/readiness e observabilidade basica, mas ainda falta uma prova autenticada de fluxo real de API apos restart.

## 2) Objetivo

Adicionar canary pos-deploy autenticado para validar rapidamente endpoints criticos (admin, agenda e atendimento) antes de concluir release.

## 3) Nao objetivos

- Nao substituir suite completa de testes funcionais.
- Nao expor credenciais de canary no pipeline.

## 4) Restricoes

- Deve funcionar no VPS via loopback.
- Deve ser compativel com rollback automatico existente.
