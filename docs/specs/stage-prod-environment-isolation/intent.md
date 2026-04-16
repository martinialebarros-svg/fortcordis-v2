# Intent - stage-prod-environment-isolation

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Problema atual

O time ainda corre risco operacional ao confundir `stage` e `prod` durante deploy, manutencao no VPS e checagens no Supabase. Esse risco aumentou porque o ambiente de `stage` foi movido para outra organizacao, continua com nome visual generico no painel e pode pausar por inatividade.

## 2) Objetivo

Estabelecer uma fonte de verdade unica para isolamento de ambientes, com:
- matriz oficial de `stage` e `prod`;
- reforco dos refs corretos do Supabase e caminhos da VPS nos runbooks;
- script simples para validar os `project refs` diretamente dos `.env` na VPS;
- compatibilidade local para uso de timezone `America/Fortaleza`.

## 3) Nao objetivos

- Nao automatizar mudanca de credenciais ou secrets na VPS.
- Nao alterar dados de producao ou stage.
- Nao substituir validacao humana antes de deploy sensivel.

## 4) Restricoes

- Os refs oficiais devem ser tratados como valores exatos:
  - `prod`: `wycxoueogfxdhyouhfhw`
  - `stage`: `dtguubpzjrkvqjryazjq`
- A validacao precisa funcionar sem dependencias externas alem do ambiente Python atual.
- A documentacao precisa permanecer aderente ao fluxo de deploy ja usado pelo repositorio.
