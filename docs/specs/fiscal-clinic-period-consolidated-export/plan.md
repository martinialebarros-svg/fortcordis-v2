# Plan - fiscal-clinic-period-consolidated-export

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (backend/API): criar endpoint de clinicas com OS no periodo.
- Fase 2 (exportacao): consolidar CSV, XLSX e PDF por clinica.
- Fase 3 (frontend): filtrar clinicas por periodo e buscar OS em lote.
- Fase 4 (validacao): adicionar testes e rodar verificacoes.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Implementar consulta por `data_atendimento`.
- [x] T1.2 Retornar dados fiscais da clinica, `qtd_os` e `valor_total`.
- Criterio de conclusao: endpoint retorna apenas clinicas ativas com OS no periodo.
- Risco: periodo invalido ou ausencia de OS.
- Rollback: remover endpoint e chamada no frontend.

### Fase 2

- [x] T2.1 Criar agrupamento consolidado por `clinica_id`.
- [x] T2.2 Atualizar CSV e XLSX para layout enxuto.
- [x] T2.3 Atualizar PDF para blocos consolidados.
- Criterio de conclusao: arquivos deixam de listar OS/paciente/tutor/servico individual.
- Risco: contador depender de coluna antiga.
- Rollback: restaurar exportadores anteriores.

### Fase 3

- [x] T3.1 Carregar clinicas via `/fiscal/clinicas-com-os`.
- [x] T3.2 Auto-selecionar todas no modo multiclinica.
- [x] T3.3 Buscar OS em lote por `clinica_ids`.
- Criterio de conclusao: fechamento do periodo evita lista completa de clinicas.
- Risco: usuario querer exportar clinica sem OS no periodo.
- Rollback: voltar ao endpoint `/clinicas`.

### Fase 4

- [x] T4.1 Testar endpoint de clinicas por periodo.
- [x] T4.2 Testar CSV/XLSX consolidados.
- [x] T4.3 Rodar lint, TypeScript e diff check.
- Criterio de conclusao: validacoes locais passam.
- Risco: dependencias locais fora do venv.
- Rollback: nao aplicavel.

## 3) Plano de testes

- Testes unitarios: `backend/venv/bin/python -m pytest backend/tests/test_fiscal_exportacao_consolidada.py`.
- Frontend: `npm exec eslint app/fiscal/components/ExportacaoDadosContabeisPage.tsx`.
- TypeScript: `npx tsc --noEmit`.
- Qualidade do diff: `git diff --check`.

## 4) Dependencias e bloqueios

- Dependencia 1: modelos `Clinica` e `OrdemServico`.
- Dependencia 2: endpoint fiscal `/fiscal/os-para-fiscal` com `clinica_ids`.

## 5) Checklist para iniciar execucao

- [x] `intent.md` preenchido.
- [x] `spec.md` preenchido.
- [x] Fases e rollback revisados.
- [x] Ambiente local validado.
