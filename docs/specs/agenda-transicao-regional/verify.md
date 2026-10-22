# Verify - agenda-transicao-regional

Data: 2026-10-22
Responsavel: Codex
Status: verified-stage

## Matriz de rastreabilidade

| ID | Tipo | Evidência | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | Teste local e canário instalado: flag desligado, Zoomare → Uninassau 33/30 | aprovado |
| CA-002 | aceitação | Replay instalado sexta 23/10: Zoomare fixa, destinos 33/41/42 minutos e jornada | aprovado |
| CA-003 | aceitação | Fronteiras 50+15 aceita às 10h35; 10h30, 51 e 54 recusados | aprovado |
| CA-004 | aceitação | Mesmas fixtures em sugestões, revalidação e validação de salvamento | aprovado |
| CA-005 | aceitação | Segunda transição longa recusada; preenchimento curto do bloco permitido | aprovado |
| CA-006 | aceitação | Celeiro cancelado ignorado; base validada separadamente sem quota | aprovado |
| CA-007 | aceitação | Dias distintos Realizado/60 dias completos antes de volume | aprovado |
| CA-008 | aceitação | Configuração autenticada, 17 chunks servidos e canário PostgreSQL isolado | aprovado |
| CA-009 | aceitação | HTTP com âncora atravessando meia-noite retorna vazio sem base ou Google | aprovado |
| NFR-001 | não funcional | Zero escrita em produção, zero Google no replay e na consulta operacional | aprovado |
| NFR-002 | não funcional | Schema descartável removido e nenhum paciente/contato copiado | aprovado |
| NFR-003 | não funcional | Flag ativa só em stage; backup privado; limitações registradas | aprovado |

## Execução

Implementação publicada e validada somente em stage. O replay instalado foi
executado com o merge `dd51af8c6f13709faa6957700169a648a0313c0b` do
[PR #415](https://github.com/martinialebarros-svg/fortcordis-v2/pull/415), após
sucesso terminal do
[Deploy to Stage 39757083651](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/39757083651).

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
somente cache, a validação ampla reportou backend com 2.074 testes executados,
74 skips e nenhuma falha; frontend com 1.099 testes Vitest e 23 testes Node
passando, além de lint, typecheck e build. Após a correção, o rerun final focado
passou com 90 testes.

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
dia da consulta. O mesmo replay passou no PostgreSQL isolado de stage.

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
  tentativa de avaliação da base ou chamada externa: passou localmente e no
  canário instalado em stage.

## Validação instalada em stage

Em 22/10/2026, o comando abaixo passou nas oito verificações com o código
instalado e o PostgreSQL do projeto de stage:

```sh
cd /var/www/fortcordis-stage
FORTCORDIS_PROCESS_ROLE=api backend/venv/bin/python scripts/agenda_regional_stage_canary.py \
  --expected-sha dd51af8c6f13709faa6957700169a648a0313c0b
```

- O canário confirmou o limite normal de 30 com a flag desligada, abriu as
  clínicas elegíveis com a flag ligada e recusou trechos de 51 e 54 minutos.
- Com Zoomare encerrando às 09h30, a grade de oportunidades de 15 minutos
  retornou Uninassau, Vet World e Animal Care a partir de 10h30. O teste de
  fronteira em grade de cinco minutos aceitou 50+15 às 10h35 e recusou 10h30.
- O validador usado no salvamento e a revalidação da oferta aplicaram a mesma
  margem integral e a mesma quota. Uma segunda transição longa foi recusada;
  um trecho curto dentro do novo bloco foi permitido. Não foi salvo agendamento
  operacional para produzir essa evidência.
- O ranking preservou faixas de custo de dez minutos antes da recorrência.
  Na mesma faixa, Vet World (19 dias/36 realizados) precedeu Animal Care
  (12/22) e o controle de volume concentrado (2/40). Janela: 23/08 a 21/10.
- O schema temporário foi removido. Foram zero chamadas Google, zero pacientes
  ou contatos copiados e zero registros operacionais existentes modificados.

A ativação autenticada em stage alterou apenas `agenda_rota_regras`, com backup
privado anterior e leitura posterior idêntica aos parâmetros enviados: normal
30, transição 50, margem total 15, uma transição por dia e histórico de 60 dias.
Jornada e demais configurações permaneceram iguais; o provider de autenticação
também foi preservado. O JWT de teste durou dez minutos, ficou somente em memória
e não criou sessão persistente.

O POST autenticado `/api/v1/agenda/oportunidades-dia` para Ecocardiograma em
23/10 retornou 200 e zero chamadas Google. O banco operacional de stage não tem
clínicas recorrentes elegíveis nessa janela e retornou lista vazia; por isso a
evidência de horários e ranking vem do replay isolado descrito acima.

O HTML autenticado de `/agenda/fullcalendar?data=2026-10-23` retornou 200. Os 17
scripts da página foram baixados com 200 e continham `Completar dia` e
`regional_transition_enabled`. Isso confirma HTML e bundles publicados; não é
uma alegação de interação em navegador. Nos domínios canônico
`app.stage.fortcordis.com.br` e alias `stage.fortcordis.com.br`, a entrada `/`
retornou 200 e o novo POST sem autenticação retornou 401.

Os logs de deploy confirmaram a restauração dos seis arquivos de runtime
preservados. O SHA de produção, consultado somente por metadados Git antes e
depois da instalação, permaneceu `c0639fc0c19434fcb38655ffdda44bd7c3f783df`.
Nenhuma ativação, deploy ou escrita em banco de produção foi executada.

Evidências JSON locais, na pasta de artefatos desta tarefa:

- `agenda-transicao-regional-stage-canary.json`: replay instalado e remoção do schema.
- `agenda-transicao-regional-stage-activation-smoke.json`: configuração, API autenticada e bundles.
- `agenda-transicao-regional-stage-public-smoke.json`: canônico, alias e proteção anônima.

## Limites da evidência

As clínicas, horários e durações são o recorte operacional mínimo do cenário já
apurado. Histórico individual de pacientes e contatos não é necessário. As rotas
reproduzidas não atualizam trânsito. A reprodução prova a regra aplicada pelo
código instalado em stage; ela não confirma clientes disponíveis nem cria ofertas
ou reservas reais.

## Decisão de release

- [x] Validação local concluída.
- [x] Publicado e validado em stage.
- [ ] Autorizado para produção — não solicitado nesta entrega.
