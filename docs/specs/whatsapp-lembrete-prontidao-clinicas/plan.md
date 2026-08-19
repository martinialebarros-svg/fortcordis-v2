# Plan - whatsapp-lembrete-prontidao-clinicas

## Fase 1 - backend

- [x] P1.1 `list_clinicas_prontidao_whatsapp_lembrete(db)` em
  `whatsapp_reminder_scheduler_service.py`, reaproveitando a mesma
  resolução de destino de `_resolve_destination` e a validação real
  `normalize_whatsapp_number` (`whatsapp_agenda_service.py`);
- [x] P1.2 endpoint `GET /agenda/whatsapp/lembrete-clinicas-prontidao`
  em `whatsapp_agenda.py`, mesmo padrão de auth do preview existente.

## Fase 2 - frontend

- [x] P2.1 estado `prontidaoClinicas`/`prontidaoClinicasStatus` e
  função `verificarProntidaoClinicas` em `configuracoes/page.tsx`;
- [x] P2.2 botão sob demanda + resumo + lista de problemas com link
  "Corrigir" para `/clinicas/:id`, inserido na seção do lembrete
  automático.

## Fase 3 - verificação

- [x] P3.1 `test_whatsapp_reminder_scheduler_service.py`: 2 testes novos
  (classificação por motivo; fallback para `telefone`), reaproveitando
  o padrão de fixture já existente no arquivo;
- [x] P3.2 suíte completa do backend (815 testes) sem regressão;
- [x] P3.3 `tsc --noEmit`, `eslint --max-warnings=0`, `next build` no
  frontend, sem erros;
- [x] P3.4 verificação manual: login local, tela de Configurações,
  clique no botão, confirma resumo e links "Corrigir" apontando para
  `/clinicas/:id` corretos (dados de teste locais).

## Fase 4 - priorização por volume de agendamentos (a pedido do usuário)

Usuário pediu explicitamente uma lista das clínicas que solicitaram
agendamento nos últimos 60 dias, ordenada da maior para a menor, para
focar a revisão manual pelas de maior movimento primeiro.

- [x] P4.1 `list_clinicas_prontidao_whatsapp_lembrete` passou a contar
  `Agendamento` por `clinica_id` dentro da janela (`created_at >=
  now - janela_dias`, padrão 60) e a retornar **todas** as clínicas
  ativas (não só as com problema) já ordenadas por essa contagem;
- [x] P4.2 UI em Configurações atualizada para renderizar a lista
  completa ordenada, com badge verde ("pronta") ou âmbar (com motivo),
  contagem de agendamentos visível em cada linha;
- [x] P4.3 novo teste `..._conta_e_ordena_por_agendamentos_60_dias`
  cobrindo contagem, exclusão de agendamentos fora da janela, e ordem.

## Rollback

- Remover o endpoint e a seção da UI restaura o comportamento anterior
  (nada mudou no fluxo de habilitar o lembrete). Nenhuma migração
  envolvida — função somente leitura, sem novas colunas/tabelas.
