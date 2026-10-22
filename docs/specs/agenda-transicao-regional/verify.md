# Verify - agenda-transicao-regional

Data: 2026-10-22
Responsavel: Codex
Status: in-progress

## Matriz de rastreabilidade

| ID | Tipo | Evidência | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | Teste local e canário: flag desligado, Zoomare → Uninassau 33/30 | pendente |
| CA-002 | aceitação | Replay sexta 23/10: Zoomare fixa, destinos 33/41/42 minutos e jornada | pendente |
| CA-003 | aceitação | Fronteiras 50+15 aceita às 10h35; 10h30, 51 e 54 recusados | pendente |
| CA-004 | aceitação | Mesmas fixtures em sugestões, revalidação e validação de salvamento | pendente |
| CA-005 | aceitação | Segunda transição longa recusada; preenchimento curto do bloco permitido | pendente |
| CA-006 | aceitação | Celeiro cancelado ignorado; base validada separadamente sem quota | pendente |
| CA-007 | aceitação | Dias distintos Realizado/60 dias completos antes de volume | pendente |
| CA-008 | aceitação | Configuração backend/frontend; SHA instalado e canário isolado de stage | pendente |
| CA-009 | aceitação | HTTP com âncora atravessando meia-noite retorna vazio sem base ou Google | pendente |
| NFR-001 | não funcional | Zero produção, zero Google no canário | pendente |
| NFR-002 | não funcional | Schema descartável removido e nenhum paciente/contato copiado | pendente |
| NFR-003 | não funcional | Flag reversível, sem alegação de demanda/trânsito atualizado | pendente |

## Execução

Implementação e integração em andamento. Não há evidência de publicação ou de
canário instalado nesta versão do documento. Os critérios de integração e stage
continuam pendentes até a reprodução com o código final.

Validação local já executada:

- `PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests
  -p 'test_agenda_regional_transition.py'`: 20 testes passaram (limites, quota,
  vizinhos, cancelamento, base e preservação de compromissos existentes).
- `python3 -m unittest tests.test_agenda_route_rules_normalization` em `backend/`:
  8 testes passaram.
- `./node_modules/.bin/vitest run lib/agenda-route-rules.test.ts` em `frontend/`:
  21 testes passaram.
- `./node_modules/.bin/tsc --noEmit`: passou no snapshot da configuração.
- ESLint de `app/configuracoes/page.tsx`, `lib/agenda-route-rules.ts` e
  `lib/agenda-route-rules.test.ts`: passou.
- `./node_modules/.bin/vitest run components/agenda/AgendaDayOpportunities.test.tsx`:
  7 testes passaram, incluindo consulta explícita por serviço, manutenção do
  ranking, cancelamento de resposta antiga e erro/retry.
- `./node_modules/.bin/tsc --noEmit` e ESLint de
  `app/agenda/fullcalendar/page.tsx`, `components/agenda/AgendaDayOpportunities.tsx`
  e seu teste: passaram com a interface de oportunidades integrada.
- `python3 -m py_compile scripts/agenda_regional_stage_canary.py`: passou.

O comando de backend acima foi executado com URL SQLite e chave sintética; nenhum
banco operacional foi usado. Antes da correção final de primeira saída no modo
somente cache, a validação ampla reportou backend com 2.074 testes passando e 74
skips; frontend com 1.099 testes Vitest e 23 testes Node passando, além de lint,
typecheck e build. O rerun focado pós-correção está pendente de evidência do
responsável pela integração.

O replay local completo de `run_checks(engine)` do canário passou em SQLite
descartável, com oito verificações integradas de flag, horários da sexta,
fronteiras 50/51, margem de 15, validação de escrita, cancelamento, base, segunda
transição, prioridade e âncora atravessando meia-noite. Esse replay foi repetido
após a correção final de primeira saída e o reuso de contexto. Evidência local:
`/Users/martiniano/.codex/visualizations/2026/10/22/01a16180-d57b-7bc1-bd6d-2cd063166529/agenda-transicao-regional-local-canary.json`.

Na grade de cinco minutos usada para testar a fronteira, Uninassau abre às 10h20,
Animal Care/Vet World às 10h30 e um trecho de 50 minutos às 10h35. As oportunidades
na grade de 15 minutos oferecem Uninassau, Vet World e Animal Care às 10h30. O
ranking preserva o custo de rota antes de recorrência e coloca Vet World
(19 dias/36 realizados) antes de Animal Care (12/22) e do controle concentrado
(2/40) na mesma faixa de custo. A janela retornada é 23/08 a 21/10, sem incluir o
dia da consulta. A aprovação instalada em PostgreSQL de stage segue pendente.

Revisão de leitura da UI e do serviço de oportunidades:

- A autenticação é obrigatória e o serviço restringe a consulta aos papéis da
  equipe da agenda. A resposta contém clínica, horários e histórico agregado,
  sem paciente, tutor, telefone ou observações.
- A consulta usa matriz dirigida confiável salva (TTL/geocodificação válida ou
  ajuste manual). Seu resolvedor não chama provider, ledger, mensagens ou rotinas
  de reserva. A busca após a primeira âncora evita consultar saída da base.
- O ranking usa acréscimo de rota, descontando o trecho direto substituído em
  encaixes entre dois compromissos, em faixas de dez minutos antes de dias
  distintos realizados e volume realizado. A referência histórica é hoje.
- A UI exige serviço e clique, mostra que os horários não estão reservados e
  cancela/descarta resultados antigos de data, serviço, identidade, fechamento e
  desmontagem.
- A borda identificada para âncora legada que termina no dia seguinte foi
  corrigida: o serviço retorna nenhuma oportunidade antes de converter para
  `HH:MM`. O modo somente cache do núcleo também exige âncora anterior e nunca
  chama a avaliação da primeira saída. O canário local testou a consulta normal
  e a rota HTTP com Zoomare sintética das 23h30 à meia-noite, bloqueando qualquer
  tentativa de avaliação da base ou chamada externa: passou. A prova instalada
  em stage continua pendente.

## Limites da evidência

As clínicas, horários e durações são o recorte operacional mínimo do cenário já
apurado. Histórico individual de pacientes e contatos não é necessário. As rotas
reproduzidas não atualizam trânsito. A reprodução prova a regra aplicada pelo
código instalado em stage; ela não confirma clientes disponíveis nem cria ofertas
ou reservas reais.

## Decisão de release

- [ ] Validação local concluída.
- [ ] Publicado e validado em stage.
- [ ] Autorizado para produção — não solicitado nesta entrega.
