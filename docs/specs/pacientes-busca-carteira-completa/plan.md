# Plan - pacientes-busca-carteira-completa

Data: 2026-09-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): não aplicável.
- Fase 2 (backend/API): devolver o total ativo antes da busca textual.
- Fase 3 (frontend): implementar busca remota paginada e estados de interface.
- Fase 4 (integracao/observabilidade): testar contrato, lint, tipos, build e guardrail SDD.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que não há alteração de banco.
- Criterio de conclusao: nenhum schema ou dado é modificado.
- Risco: não aplicável.
- Rollback: não aplicável.

### Fase 2

- [x] T2.1 Calcular `total_ativos` antes de aplicar `search`.
- [x] T2.2 Preservar `total` e `items` do contrato atual.
- Criterio de conclusao: resposta diferencia total ativo de total filtrado.
- Risco: uma contagem adicional por busca.
- Rollback: reverter a chave adicional sem impacto de banco.

### Fase 3

- [x] T3.1 Trocar a consulta fixa de 1.000 por `limit=100`, `skip` e `search`.
- [x] T3.2 Adicionar debounce, paginação e estado de falha.
- Criterio de conclusao: qualquer paciente ativo é buscável pelo servidor.
- Risco: seleção em lote atravessar páginas.
- Rollback: reverter o componente; a seleção fica deliberadamente limitada à página visível.

### Fase 4

- [x] T4.1 Executar testes focados e verificações de frontend.
- [x] T4.2 Executar guardrail SDD sobre o diff.
- Criterio de conclusao: todos os comandos definidos em `verify.md` passam.
- Risco: ambiente local sem sessão autenticada para validação visual remota.
- Rollback: reverter o diff completo.

## 3) Plano de testes

- Testes unitarios: contrato de `listar_pacientes` e componente de busca/paginação.
- Testes de integracao: resposta de busca com total ativo e total filtrado.
- Testes manuais: busca por paciente fora da primeira página, paginação e tentativa após erro.

## 4) Dependencias e bloqueios

- Dependencia 1: API autenticada de pacientes já expõe `search`.
- Dependencia 2: sessão interna é necessária apenas para smoke remoto, não para validação automatizada.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local).
