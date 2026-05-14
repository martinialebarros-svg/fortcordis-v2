# Plan - api-02-n-plus-one-agenda-for28

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Plano de execucao

1. Mapear endpoints da Agenda com maior risco de N+1 em leitura.
2. Extrair query base com joins de relacionados para uso compartilhado.
3. Aplicar query compartilhada em `listar_agendamentos` e `agendamentos_hoje`.
4. Criar teste de regressao com captura de SQL para impedir query por item.
5. Executar suite da Agenda e registrar evidencias no SDD.
