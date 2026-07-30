# Plan - atendimento-demographics-document-sync

Data: 2026-07-30
Responsavel: Codex
Status: done

1. Expor sexo na complementacao cadastral.
2. Adicionar acao de edicao no cabecalho clinico e apresentar o sexo atual.
3. Consolidar paciente e tutor em um unico payload de atualizacao.
4. Tornar o PUT de paciente realmente parcial, sem defaults destrutivos.
5. Fazer receita e solicitacao resolverem o tutor atual do paciente.
6. Impedir cache de PDFs no backend e adicionar cache-buster no frontend.
7. Cobrir preservacao de sexo omitido, atualizacao conjunta e reimpressao com
   dados atuais.
8. Executar testes direcionados, suite backend, lint, TypeScript, build,
   `git diff --check` e guardrail SDD.
