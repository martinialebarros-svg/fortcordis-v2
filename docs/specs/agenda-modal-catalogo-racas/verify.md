# Verify

## Verificações executadas

- `cd frontend && npx vitest run lib/racas.test.ts`
- `cd frontend && npx tsc --noEmit -p tsconfig.json`
- `cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx lib/racas.ts lib/racas.test.ts --max-warnings=0`
- `cd frontend && npm run build`

Resultado: aprovado. Os três testes cobrem ordenação, cadastro sem duplicidade,
renomeação e exclusão de raça padrão/personalizada, incluindo a preservação de
um valor histórico na lista de seleção.

## Cenário manual pendente

- Abrir `/agenda` com sessão autenticada, clicar em **Adicionar pet** e
  confirmar visualmente: dropdown alfabético, cadastro de nova raça, edição,
  confirmação de exclusão e salvamento do animal com a raça escolhida.

## Limitação do ambiente local

- A interface local respondeu em `http://127.0.0.1:3002/agenda`, mas redirecionou
  para autenticação e não havia backend local disponível para executar o fluxo
  autenticado ponta a ponta nesta sessão.
