# Especificacao

## Requisitos funcionais
- RF-01: mover lógica de painéis customizados de exames para service dedicado.
- RF-02: manter respostas e códigos HTTP dos endpoints de `/paineis` sem alteração de contrato.
- RF-03: manter suporte à geração de código único, validação de catálogo e serialização de itens.
- RF-04: mover lógica CRUD de frases clínicas para service dedicado.
- RF-05: manter respostas e códigos HTTP dos endpoints de `/frases-clinicas*` sem alteração de contrato.
- RF-06: mover lógica CRUD de templates de documentos para service dedicado.
- RF-07: manter respostas e códigos HTTP dos endpoints de `/documentos/templates*` sem alteração de contrato.
- RF-08: mover lógica CRUD de documentos de atendimento (listar, atualizar, excluir + serialização/getter) para service dedicado.
- RF-09: manter respostas e códigos HTTP dos endpoints de `/documentos*` sem alteração de contrato.
- RF-10: mover lógica de contexto/renderização de templates de documentos para service dedicado.
- RF-11: manter fluxo de criação/PDF de documentos sem alteração de comportamento.
- RF-12: garantir sincronização da lista de documentos no frontend após criar/salvar/emitir PDF/excluir.
- RF-13: permitir entrada de idade informada no card de complementação cadastral e estimar automaticamente a data de nascimento.

## Requisitos não funcionais
- RNF-01: refactor sem regressão funcional nas rotas de painéis customizados.
- RNF-02: código extraído deve ser reutilizável por outros módulos de atendimento.
