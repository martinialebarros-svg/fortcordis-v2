# Plan — ajuste de valor de OS pendente

Data: 2026-10-06
Responsável: Codex
Status: implementação e validação local concluídas; publicação autorizada

## Sequência

1. Trabalhar na worktree isolada e preservar alterações do checkout original.
   Conferir os contratos da finalização de Atendimento, da OS, do recebimento
   e dos resumos financeiros antes de editar código.
2. Criar `PATCH /ordens-servico/{id}/ajustar-valor` com validação monetária,
   motivo obrigatório, permissão de edição e comparação do valor esperado.
   Sob controle de concorrência, alterar somente a composição monetária da
   OS `Pendente` e gravar o evento específico de auditoria na mesma sessão e
   no mesmo commit. Rejeições não alteram OS nem criam evento de sucesso.
3. Reutilizar a estrutura existente de `ordens_servico` e `auditoria_eventos`,
   sem migração se nenhuma coluna adicional for necessária. Não usar a
   auditoria best-effort em sessão separada para este ajuste.
4. Expor uma ação clara na linha da OS nas abas Cobranças e Ordens. Mostrar
   valor atual, entrada do novo valor e motivo; enviar o valor exibido como
   `valor_final_esperado`. Bloquear submissão inválida/duplicada e, em `409`,
   atualizar a leitura e pedir revisão humana antes de novo envio.
5. Após sucesso, recarregar OS e grupos/totais de cobrança e limpar seleção
   cujo preço ficou obsoleto. Enviar o valor observado também na baixa
   individual e em lote; o servidor rejeita com `409` uma mudança de preço
   entre a conferência e a gravação. O lembrete financeiro agendado usa o
   valor persistido atual, sem mensagem externa adicional de ajuste.
6. Validar casos de backend, UI e regressão dirigidos; registrar comandos,
   resultados e limites em `verify.md`. Só marcar um critério como aprovado
   após evidência executada.

## Falha segura e reversão

Valor esperado divergente, status diferente de `Pendente`, falta de permissão,
entrada inválida ou falha de auditoria deixam preço, vínculos e estados como
estavam. Reversão de código não deve restaurar automaticamente valores já
ajustados: cada correção financeira precisa permanecer rastreável. Não há
alteração automática do caso real durante a publicação autorizada.

## Verificações previstas

- Backend: precisão decimal, preço/desconto, permissão, auditoria atômica,
  concorrência, status, finalização repetida e recebimento posterior.
- Frontend: ações nas duas abas, validação, conflito, erro, recarga de totais
  e invalidação de seleção para baixa.
- Integração: leitura dos novos valores em Ordens, Cobranças, portal da
  clínica e relatórios pendentes; push com valor atual.
- Qualidade: testes focados e regressão pertinente, lint, tipos, build,
  `git diff --check` e guardrail SDD.
