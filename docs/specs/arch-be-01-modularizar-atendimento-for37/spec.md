# Especificacao

## Requisitos funcionais
- RF-01: mover lógica de painéis customizados de exames para service dedicado.
- RF-02: manter respostas e códigos HTTP dos endpoints de `/paineis` sem alteração de contrato.
- RF-03: manter suporte à geração de código único, validação de catálogo e serialização de itens.

## Requisitos não funcionais
- RNF-01: refactor sem regressão funcional nas rotas de painéis customizados.
- RNF-02: código extraído deve ser reutilizável por outros módulos de atendimento.
