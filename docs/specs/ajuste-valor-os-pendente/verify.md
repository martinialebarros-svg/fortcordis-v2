# Verify — ajuste de valor de OS pendente

Data: 2026-10-06
Responsável: Codex
Status: validação local concluída; publicação autorizada

As verificações usaram bancos e dados sintéticos. Nenhuma OS real foi
modificada.

## 1. Matriz de rastreabilidade

| ID | Evidência requerida | Status |
| --- | --- | --- |
| CA-001 | Teste com OS de Atendimento sintética, desconto e vínculos/status preservados | ok local |
| CA-002 | Evento de auditoria na mesma transação e rollback induzido por falha da tabela | ok local |
| CA-003 | Duas sessões SQLite: ajuste × ajuste e ajuste × receber; uma operação prevalece, sem perda nem divergência financeira | ok local |
| CA-004 | `Pago`, `Cancelado`, centavos, limite, motivo, recebimento ativo e matriz `PATCH → editar` rejeitados sem ajuste | ok local |
| CA-005 | UI de Cobranças/Ordens, valor esperado no ajuste e na baixa individual/lote, recarga, seleção limpa e `409` sem crédito | ok local |
| CA-006 | Finalização repetida preserva OS/valor; recebimento e lembrete usam preço atual | ok local |
| CA-007 | Portal da clínica e payload do PDF de pendências leem valor ajustado sem motivo | ok local |

## 2. Testes e verificações executados

```bash
cd backend
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest discover -s tests -q
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest tests.test_ordens_servico_ajuste_valor -q

cd ../frontend
npm test
npm run lint
npm run build

cd ..
git diff --check
```

- Backend completo: **1.558 testes**, `OK (skipped=7)`. A execução começou
  antes de acrescentar os dois testes de leitura do portal/PDF; depois, o
  arquivo focado completo passou com **17 testes**.
- Frontend: **528 testes Vitest** e **9 testes Node**; lint e build de produção
  passaram. O build também conferiu os tipos TypeScript.
- Após integrar `origin/stage` de 2026-10-06, passaram **30 testes backend**
  dirigidos, **529 testes Vitest** e **9 testes Node**. O gate SDD e o gate
  de critérios da promoção passaram contra essa base. A alteração trazida
  de stage afetou apenas Agenda, sem sobreposição com os arquivos desta
  feature.
- `git diff --check` passou nos arquivos rastreados; uma varredura dos cinco
  arquivos novos encontrou zero linhas com espaços finais. A função
  `evaluate_guardrail` do gate SDD passou
  com inventário dos arquivos rastreados e não rastreados: 10 arquivos, 6 de
  código, feature `ajuste-valor-os-pendente` qualificada. A CLI baseada em
  dois commits ainda não se aplica à worktree sem commit.

## 3. Verificação operacional para a publicação

1. Em ambiente de stage com dados de teste, abrir uma OS pendente gerada pela
   finalização de Atendimento, ajustar o valor em Cobranças e confirmar
   recarga da OS e do total do destinatário.
2. Abrir a mesma OS em Ordens, verificar o novo valor e a auditoria; recarregar
   Atendimento e Agenda e conferir status e vínculos preservados.
3. Em outra sessão, manter o formulário com valor antigo, realizar
   outro ajuste e confirmar o `409` sem perda da primeira alteração.
4. Conferir que baixar relatório de pendências ou ler o portal da clínica
   mostra o novo valor. Não enviar cobrança/WhatsApp real.

## 4. Limites da validação local

- A concorrência foi reproduzida e corrigida em SQLite temporário. O
  PostgreSQL usa `FOR UPDATE`, mas não houve ensaio concorrente num servidor
  PostgreSQL nem smoke em stage nesta entrega local.
- O campo `valor_final_esperado` do recebimento é opcional para preservar
  clientes legados; esta proteção de intenção é exercida pelos fluxos da UI
  que o enviam. Um cliente legado que não o envia mantém a semântica anterior.
- O fluxo legado `Editar` ainda pode recalcular valor ao trocar serviço,
  horário ou desconto e usa sua auditoria preexistente. Editar somente
  observações não envia campos de preço e preserva o valor ajustado.
- Cobranças e mensagens já enviadas antes da correção não são reemitidas;
  lembretes futuros consultam o valor atual da OS.

## 5. Decisão de entrega

- [x] Critérios de aceitação comprovados localmente.
- [x] Publicação em stage e produção autorizada pelo usuário em 2026-10-06
  ("publique"); execução condicionada aos gates e à verificação de cada
  ambiente.
