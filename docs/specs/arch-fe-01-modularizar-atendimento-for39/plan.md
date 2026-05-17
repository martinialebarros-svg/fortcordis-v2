# Plan - arch-fe-01-modularizar-atendimento-for39

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## Fases

1. Mapeamento
- Identificar utilitarios puros no `page.tsx` com potencial de extracao imediata.

2. Extracao segura
- Criar modulo `frontend/lib/atendimento-utils.ts`.
- Mover utilitarios sem alterar assinatura/comportamento.

3. Integracao
- Atualizar imports e remover duplicacoes locais no `page.tsx`.

4. Validacao
- Executar lint focal nos arquivos alterados.
- Executar build de frontend.

5. Rollout
- Commit limpo da fatia.
- Push para `stage`.

## Riscos

- Dependencia residual em tipos/assinaturas apos extracao.
- Falsos positivos de guardrail se artefatos SDD nao acompanharem o diff.

## Mitigacoes

- Validacao `npm run build` antes do push.
- Inclusao de artefatos SDD completos da feature no ciclo.
