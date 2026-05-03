# Plan - clinic-fiscal-names

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## Fases

1. Atualizar formularios completos de clinicas.
2. Atualizar cadastro rapido de clinica no modal de agendamento.
3. Melhorar busca/exibicao na listagem.
4. Validar frontend/backend e disparar deploy.

## Tarefas

- [x] T1 Adicionar `razao_social` ao estado e payload de `/clinicas/novo`.
- [x] T2 Adicionar `razao_social` ao carregamento, estado e payload de `/clinicas/[id]`.
- [x] T3 Renomear label de `Nome da Clinica` para `Nome Fantasia`.
- [x] T4 Adicionar `clinica_nova_razao_social` ao `NovoAgendamentoModal`.
- [x] T5 Enviar `razao_social` no cadastro rapido via `POST /clinicas`.
- [x] T6 Buscar e exibir razao social na listagem de clinicas.

## Rollback

Reverter o commit da feature e fazer novo deploy de `main`.
