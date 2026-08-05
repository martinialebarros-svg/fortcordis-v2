# Intent - laudo-ecocardiograma-save-alert

Data: 2026-07-30
Responsavel: Martiniano + Codex
Status: done

## 1) Problema atual

O editor permite concluir o salvamento de um ecocardiograma sem que a analise
qualitativa estruturada tenha sido aplicada ao laudo oficial e sem imagens do
exame. Essa omissao pode passar despercebida no fluxo de criacao ou edicao.

## 2) Objetivo

Alertar o usuario antes da persistencia quando um ou ambos os itens estiverem
ausentes, permitindo revisar a pendencia ou confirmar conscientemente o
salvamento excepcional.

## 3) Nao objetivos

- Impedir definitivamente laudos sem imagens ou analise qualitativa.
- Alterar o backend, o banco, o PDF ou a regra de aplicacao da analise.
- Aplicar textos clinicos automaticamente.

## 4) Contexto e restricoes

- O alerta deve existir em `Novo laudo` e na edicao.
- A verificacao deve ocorrer antes de qualquer chamada de salvamento do fluxo.
- Laudos de pressao arterial e de outros tipos nao participam da regra.
- Imagem temporaria conta somente depois de upload concluido; imagem ja
  persistida conta imediatamente.

## 5) Impacto esperado

- Usuarios impactados: veterinarios que elaboram ecocardiogramas.
- Modulos impactados: frontend de laudos.
- Risco de regressao: baixo, limitado ao inicio da acao de salvar.

## 6) Riscos iniciais

- Alertar incorretamente laudos de outro tipo.
- Considerar como carregada uma imagem cujo upload falhou.
- Bloquear um salvamento excepcional necessario.

## 7) Perguntas abertas

- Nenhuma para esta entrega.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
