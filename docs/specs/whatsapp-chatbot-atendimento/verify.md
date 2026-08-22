# Verify - whatsapp-chatbot-atendimento

Data: 2026-08-20  
Responsavel: Martiniano + Claude  
Status: draft

> Nenhuma fase do `plan.md` foi executada. Este arquivo existe preenchido com a
> matriz de rastreabilidade planejada — a evidência de cada critério é
> registrada conforme as fases forem entregues, e nenhum item pode ser marcado
> como `ok` sem teste ou log correspondente.

## Matriz de rastreabilidade

| ID | Tipo | Evidência planejada | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | teste de fila: inbound de texto cria 1 job `pending` com `scheduled_for` futuro | pendente |
| CA-002 | aceitação | teste de fila: segundo POST com o mesmo `wa_message_id` não cria job | pendente |
| CA-003 | aceitação | teste de debounce: 3 mensagens -> 2 jobs `superseded` + 1 ativo, 1 resposta | pendente |
| CA-004 | aceitação | teste do endpoint: enfileiramento com exceção forçada mantém `200` e as contagens do push | pendente |
| CA-005 | aceitação | teste dos portões com cada interruptor em `false`: 0 jobs processados, 0 envios | pendente |
| CA-006 | aceitação | teste do worker em `suggest`: decisão `draft`, cliente HTTP do Node nunca chamado | pendente |
| CA-007 | aceitação | teste de pausa: mensagem humana -> `pausado_ate` no futuro, próximo job `suppressed` | pendente |
| CA-008 | aceitação | teste de janela: `last_inbound_at` com mais de 24h -> `suppressed` | pendente |
| CA-009 | aceitação | teste por tipo: `audio`/`image`/`document` -> `handoff` sem geração | pendente |
| CA-010 | aceitação | teste de pedido de humano: `pending` no Node, alerta criado, provider de LLM não chamado | pendente |
| CA-011 | aceitação | teste de emergência: resposta fixa, `criar_alerta_interno(nivel="critico")`, gerador não chamado | pendente |
| CA-012 | aceitação | teste do nono dígito em `test_whatsapp_conversation_context.py`: `matched` para as duas formas | pendente |
| CA-013 | aceitação | teste de escopo: contexto `ambiguous`/`not_found` -> resposta sem dado de registro | pendente |
| CA-014 | aceitação | teste de allowlist: intent fora da lista em conversa `auto` -> `draft` | pendente |
| CA-015 | aceitação | teste do validador: candidata com conteúdo clínico -> `blocked` + motivo gravado | pendente |
| CA-016 | aceitação | teste de fonte: sem tool e sem trecho recuperado -> não envia | pendente |
| CA-017 | aceitação | teste de teto: acima do limite diário -> `suppressed` com motivo de teto | pendente |
| CA-018 | aceitação | teste de envio em `auto`: chamada ao Node com `metadata.origem = "bot"` | pendente |
| CA-019 | aceitação | teste do preview: nenhum job alterado, nenhuma geração, nenhum envio | pendente |
| CA-020 | aceitação | teste de autorização em `test_configuracoes_autorizacao.py` (403 para não admin) + smoke sem restart | pendente |
| CA-021 | aceitação | teste do worker com advisory lock ocupado: ciclo pulado, 0 jobs tocados | pendente |
| CA-022 | aceitação | teste de redação de log: corpo completo e número completo ausentes da saída | pendente |
| CA-023 | aceitação | teste de escopo entre personas: conversa `clinica` sem dado de tutor de outra clínica, e vice-versa | pendente |
| CA-024 | aceitação | teste de allowlist: intent de OS/cobrança em `auto` -> `draft` nas duas personas | pendente |
| CA-025 | aceitação | teste de handoff: fora da janela informa próximo horário; dentro, informa transferência; emergência mantém contato imediato | pendente |
| CA-026 | aceitação | teste de corrida: claim durante o debounce -> job `suppressed`, sem envio e sem rascunho | pendente |
| NFR-001 | não funcional | inspeção de `config.py`/`.env.example`/migração: todos os defaults desligados | pendente |
| NFR-002 | não funcional | medição do tempo do endpoint de mensagem recebida antes e depois do enfileiramento | pendente |
| NFR-003 | não funcional | `build_runtime_report()` expondo `whatsapp_bot_worker` | pendente |
| NFR-004 | não funcional | revisão dos logs emitidos em um ciclo completo em stage | pendente |
| NFR-005 | não funcional | contadores de custo por conversa em `whatsapp_bot_respostas` + degradação para `suggest` | pendente |
| NFR-006 | não funcional | teste de migração idempotente (aplicar duas vezes, e no-op sem tabela) | pendente |
| NFR-007 | não funcional | inspeção: nenhuma query do backend principal em `conversations`/`messages` | pendente |

## Testes automatizados a executar

```bash
# backend
cd backend
venv/bin/python -m unittest tests.test_whatsapp_bot_migration -v
venv/bin/python -m unittest tests.test_whatsapp_bot_queue_service -v
venv/bin/python -m unittest tests.test_whatsapp_bot_worker_service -v
venv/bin/python -m unittest tests.test_whatsapp_bot_gates -v
venv/bin/python -m unittest tests.test_whatsapp_bot_generation -v
venv/bin/python -m unittest tests.test_whatsapp_conversation_context -v
venv/bin/python -m unittest tests.test_configuracoes_autorizacao -v
venv/bin/python -m unittest discover -s tests -p "test_*.py"

# serviço WhatsApp
cd ../whatsapp-stage-backend
npm run build
npm run test:inbox-ui

# frontend
cd ../frontend
npx eslint app/whatsapp-stage/page.tsx app/configuracoes/page.tsx --max-warnings=0
npx tsc --noEmit
npx next build
```

Resumo dos resultados:
- Backend: pendente.
- Serviço WhatsApp: pendente.
- Frontend: pendente.

## Testes manuais planejados (stage)

1. `GET /api/v1/whatsapp/bot/preview` com o bot desligado — medir alcance real
   antes de habilitar, sem gerar nem enviar nada.
2. Conversa real em `suggest`: confirmar que o rascunho aparece na central e que
   nada é enviado sem clique.
3. "Quero falar com um atendente" — handoff imediato, conversa em `pending`,
   push recebido pela equipe.
4. Termo de emergência — resposta fixa, alerta interno `critico`, nenhuma
   geração.
5. Número não cadastrado — resposta sem nenhum dado de registro.
6. Mensagem de áudio — handoff, sem tentativa de resposta.
7. Janela de 24h fechada — nenhuma mensagem enviada.
8. Desmarcar o toggle em Configurações durante tráfego — o bot para no ciclo
   seguinte, sem restart.
9. Conversa de clínica parceira e conversa de tutor lado a lado — confirmar que
   a persona, o tom e o escopo de dado mudam, e que nenhuma alcança dado da
   outra.
10. Mensagem fora do expediente (bot roda 24/7) — o handoff informa o próximo
    horário de atendimento, não "vou transferir agora".
11. Atendente dá claim enquanto o debounce corre — o bot não responde por cima.

## Números a coletar na Fase 6.3 (stage)

Sem estes, a decisão de ligar o modo `auto` é chute:

| Métrica | Quebra |
| --- | --- |
| Taxa de aceite dos rascunhos | por persona (tutor / clínica) |
| Taxa de bloqueio do validador de saída | por motivo |
| Contenção (resposta sem handoff) | por persona e por dentro/fora do expediente |
| Latência da primeira resposta | por dentro/fora do expediente |
| Custo por conversa | total e p95 |

## Regressão e riscos residuais

- A correção do nono dígito (RF-015) altera um endpoint já consumido pela
  central de atendimento; exige teste de não regressão para os formatos que
  funcionam hoje.
- O endpoint de mensagem recebida passa a fazer mais trabalho no caminho do
  webhook; o timeout de 5s do Node é a margem, e NFR-002 é o limite aceito.
- Qualidade de resposta só é mensurável com tráfego real: o dado da Fase 6.3 é
  o que autoriza o modo `auto`, e antes disso qualquer estimativa é chute.
- A colisão de `DISTRIBUTED_LOCK_KEY` entre o worker de lembrete e o do
  assistente IA continua existindo (fora de escopo aqui) — o worker do bot usa
  chave própria e não piora o quadro.
- Com o bot 24/7, a janela operacional da agenda é usada como proxy do horário
  em que alguém realmente lê o inbox (CB-010). Se as duas divergirem na
  prática, o texto de handoff fora do expediente vai prometer um horário
  errado — sinal para criar configuração própria de horário de atendimento.
- Atender as duas personas no mesmo canal concentra o risco de vazamento no
  `match_type` e nos filtros das tools; CA-023 cobre o caminho feliz, mas
  número mal cadastrado ou compartilhado entre clínica e tutor continua caindo
  em `ambiguous`, que por RF-016 não revela nada — seguro, porém inútil para o
  cliente até alguém corrigir o cadastro.

## Itens fora de escopo entregues

- Nenhum até o momento.

## Decisão de release

- [ ] Aprovado para stage.
- [ ] Aprovado para produção em modo `suggest`.
- [ ] Aprovado para produção em modo `auto` (allowlist da RF-019).
- [ ] Não aprovado (descrever motivo).
