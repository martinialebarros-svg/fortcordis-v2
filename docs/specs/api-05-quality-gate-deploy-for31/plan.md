# Plan - api-05-quality-gate-deploy-for31

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Plano de execucao

1. Mapear workflows de deploy para `stage` e `main`.
2. Inserir job `quality-gate` com setup de Python/Node e etapas de teste, lint e build.
3. Encadear jobs de deploy com `needs` para bloquear publicação sem validação.
4. Corrigir falha de lint preexistente que impediria o gate de aprovar.
5. Executar validação local equivalente e registrar evidências.
