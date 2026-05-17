# Plan - arch-fe-02-padronizar-cliente-api-erros-for40

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## Fases

1. Diagnostico e baseline
- Mapear pontos de erro manual e uso de cliente HTTP nao padronizado.

2. Infra compartilhada
- Criar `frontend/lib/api-error.ts`.
- Integrar no interceptor de `frontend/lib/axios.ts`.

3. Migracao de modulos alvo
- Atendimento: substituir extracoes manuais de `detail/message` pelo utilitario.
- Servicos (novo/editar): padronizar erros com utilitario.
- Financeiro `TransacaoModal`: migrar de `axios` cru para `api`.

4. Validacao
- Rodar lint focal nos arquivos alterados.
- Rodar build frontend para validacao de tipos e compilacao.

5. Rollout
- Commit limpo da FOR-40.
- Push para `origin/stage` e acompanhamento dos workflows.

## Riscos

- Risco de erro de tipo ao extrair tipos compartilhados da tela de atendimento.
- Risco de guardrail SDD bloquear deploy se feature estiver sem artefatos obrigatorios.

## Mitigacoes

- Validacao local com `npm run build` antes do push.
- Garantir feature SDD com `intent.md`, `plan.md`, `spec.md` e `verify.md`.
