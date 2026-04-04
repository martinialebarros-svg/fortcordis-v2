# Plan - atendimento-upload-dedupe-metrics-retention

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Sequencia de fases

- Fase 1 (backend core): criar rotina de retenção e limpeza.
- Fase 2 (backend API): expor endpoint tecnico de cleanup.
- Fase 3 (qualidade): testes automatizados e validacao local.
- Fase 4 (operacao): validar em stage/producao e fechar verify.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Definir constante de retencao (90 dias).
- [x] T1.2 Implementar funcao de cleanup com cutoff.
- Criterio de conclusao: limpeza funcional com retorno de `deleted_rows`.
- Risco: comparacao de data/hora inconsistente entre dialetos.
- Rollback: manter coleta sem cleanup automatico.

### Fase 2

- [x] T2.1 Criar endpoint tecnico de cleanup manual.
- [x] T2.2 Registrar logs estruturados do cleanup.
- Criterio de conclusao: operacao consegue executar cleanup sob demanda.
- Risco: endpoint exposto sem controle suficiente.
- Rollback: restringir endpoint a uso interno/autenticado.

### Fase 3

- [x] T3.1 Adicionar testes de cleanup com e sem expirados.
- [x] T3.2 Executar suites de upload + metricas.
- Criterio de conclusao: CA-001..CA-005 validados automaticamente.
- Risco: testes com data fixa flakey.
- Rollback: usar datas deterministicas em fixture.

### Fase 4

- [x] T4.1 Rodar cleanup em stage com amostra controlada.
- [x] T4.2 Validar consulta de metricas apos cleanup.
- [x] T4.3 Atualizar `verify.md` e decisao de release.
- Criterio de conclusao: ciclo aprovado em stage e producao.
- Risco: remocao excessiva por cutoff mal configurado.
- Rollback: ajustar retenção e interromper execucoes futuras.

## 3) Plano de testes

- Testes unitarios:
- funcao de cutoff e contagem removida.
- Testes de integracao:
- endpoint cleanup retornando payload esperado.
- Testes manuais:
- inserir dados antigos/novos e confirmar remocao seletiva.

## 4) Dependencias e bloqueios

- Dependencia 1: tabela `upload_dedupe_metricas` ja implantada.
- Dependencia 2: permissao operacional para acionar cleanup em stage/producao.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
