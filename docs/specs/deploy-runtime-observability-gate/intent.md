# Intent - deploy-runtime-observability-gate

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

Os deploys validam disponibilidade basica, mas nao bloqueiam automaticamente promocao quando sinais de observabilidade criticos indicam degradacao.

## 2) Objetivo

Adicionar gate pos-deploy automatizado para validar `health/ready` e sinais de observabilidade antes de concluir deploy em stage/producao.

## 3) Nao objetivos

- Nao introduzir dependencia de token admin no GitHub Actions.
- Nao alterar regras de negocio da API.
- Nao integrar com ferramenta externa de alertas nesta iteracao.

## 4) Restricoes

- Gate deve rodar no proprio VPS via loopback (`127.0.0.1`) por seguranca.
- Mudanca deve ser reversivel e de baixo risco operacional.

## 5) Definition of Ready

- [x] Escopo claro.
- [x] Criterios de bloqueio definidos.
