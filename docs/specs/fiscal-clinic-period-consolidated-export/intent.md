# Intent - fiscal-clinic-period-consolidated-export

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Problema atual

No fechamento fiscal do periodo, a tela de exportacao listava todas as clinicas cadastradas, mesmo quando muitas nao tinham OS no intervalo. Alem disso, os arquivos enviados para a contabilidade eram detalhados por OS, aumentando ruido operacional para emitir as notas.

## 2) Objetivo

Facilitar o fechamento mensal do modulo fiscal listando apenas clinicas com OS por `data_atendimento` no periodo selecionado e gerando relatorio consolidado por clinica/tomador em CSV, XLSX e PDF.

## 3) Nao objetivos

- Nao emitir NFS-e diretamente.
- Nao alterar regras fiscais de aliquota, natureza da operacao ou regime tributario.
- Nao restringir a exportacao por status de OS alem da selecao manual do usuario.

## 4) Contexto e restricoes

- A exportacao continua usando o endpoint fiscal existente de lote de OS.
- Nao ha migracao de banco nesta entrega.
- O fluxo precisa continuar suportando uma clinica e varias clinicas.

## 5) Impacto esperado

- Usuarios impactados: financeiro/fiscal e operacao de fechamento mensal.
- Modulos impactados: fiscal backend, tela `/fiscal/exportar` e exportadores CSV/XLSX/PDF.
- Risco de regressao: divergencia no layout esperado pela contabilidade.

## 6) Riscos iniciais

- Agrupar por campo textual poderia juntar clinicas distintas com nomes iguais.
- Mudanca de layout pode impactar processos manuais baseados nas colunas antigas.

## 7) Perguntas abertas

- Nenhuma pendente para esta entrega.

## 8) Definition of Ready

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
