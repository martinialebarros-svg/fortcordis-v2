# Intent - laudo-phrase-library

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Problema atual

O editor qualitativo de ecocardiograma ja possui banco de frases e presets, mas a manutencao fica misturada ao fluxo de redacao do laudo. Isso dificulta renomear frases, organizar por patologia de base, revisar presets e controlar frases inativas sem risco de baguncar o laudo em andamento. No aspecto Conclusao, o seletor nativo tambem apresenta todas as frases em uma lista unica extensa, sem busca nem navegacao por patologia.

## 2) Objetivo

Criar uma aba Biblioteca no modulo de laudos para organizar frases e presets estruturados de ecocardiograma, com edicao segura, agrupamento por patologias multiplas, soft delete e preservacao de compatibilidade com os presets existentes. Reutilizar essa classificacao no aspecto Conclusao da aba Qualitativa, oferecendo busca e grupos expansivos sem remover a confirmacao explicita antes de aplicar uma frase.

## 3) Nao objetivos

- Migrar o armazenamento JSON para tabelas SQL.
- Alterar o formato final do PDF do laudo.
- Criar uma pagina administrativa separada fora do fluxo de laudos.

## 4) Contexto e restricoes

- Restricoes tecnicas: preservar o arquivo `backend/data/frases_ecocardiograma_estruturado_teste.json` como fonte atual.
- Restricoes de prazo: entregar uma primeira versao funcional em stage para validacao visual e operacional.
- Restricoes operacionais: evitar exclusao definitiva de frases/presets clinicos.

## 5) Impacto esperado

- Usuarios impactados: equipe que produz e revisa laudos ecocardiograficos.
- Modulos impactados: laudos, editor qualitativo estruturado e API de frases/presets.
- Risco de regressao: presets existentes podem perder referencias se renomeio/movimentacao de frases nao sincronizar corretamente.

## 6) Riscos iniciais

- Risco 1: normalizacao do JSON alterar metadados runtime de forma inesperada.
- Risco 2: presets passarem a apontar para frases inativas ou movidas sem sinalizacao.

## 7) Perguntas abertas

- Nenhuma pendente para a primeira versao.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
