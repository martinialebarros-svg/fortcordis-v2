# Plan - fiscal-numero-unico-for22

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Tarefas

- [x] Adicionar migration para indice unico em `notas_fiscais.numero`.
- [x] Bloquear aplicacao da migration quando existirem duplicidades previas.
- [x] Fortalecer criacao de NF com retry transacional em colisao de numero.
- [x] Cobrir com testes de migration e fluxo de criacao.
