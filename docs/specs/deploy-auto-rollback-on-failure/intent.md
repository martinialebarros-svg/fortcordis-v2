# Intent - deploy-auto-rollback-on-failure

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

Mesmo com gate de observabilidade, uma falha no deploy pode deixar o ambiente indisponivel ate intervencao manual.

## 2) Objetivo

Adicionar rollback automatico no script de deploy para retornar ao commit anterior quando o deploy falhar apos atualizar o codigo.

## 3) Nao objetivos

- Nao fazer downgrade automatico de schema.
- Nao substituir processo de rollback manual em incidentes complexos.

## 4) Restricoes

- Solucao precisa ser segura contra loop de rollback.
- Deve preservar arquivos runtime locais (db/frases).
