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
| CA-010 | aceitação | Regressões de direção ausente cedo e tarde, preservando slots conhecidos | aprovado em stage pelo PR #420 |
| CA-011 | aceitação | Baseline desconhecido, custo direto, direção e contador por clínica | aprovado em stage pelo PR #420 |
| CA-012 | aceitação | Replay instalado de matriz incompleta em stage, sem produção | aprovado em stage no workflow 39794689074 |
| CA-013 | aceitação | Lista completa com 31/61 clínicas, compatibilidade de limites e ranking | em validação neste ciclo |
| CA-014 | aceitação | Stage instalado, lista sem corte e hashes operacionais preservados | em validação neste ciclo |
| NFR-001 | não funcional | Zero escrita em produção, zero Google no replay e na consulta operacional | aprovado |
| NFR-002 | não funcional | Schema descartável removido e nenhum paciente/contato copiado | aprovado |
| NFR-003 | não funcional | Flag ativa só em stage; backup privado; limitações registradas | aprovado |

## Execução

### Lista completa no Completar dia — 22/10/2026

O usuário autorizou remover o corte de 20 clínicas e validar primeiro em stage,
sem alterar agendamentos. A UI solicita `limite: null` e mostra a contagem de
clínicas com horários disponíveis. A API aceita esse modo para retornar todas
as oportunidades calculadas; mantém o padrão 20 quando omitido e os limites
numéricos de 1 a 50 para consumidores existentes. Não muda o limite interno de
candidatos de horário por clínica, o ranking, a recorrência ou as regras de rota.

Cobertura deste ciclo: 31 e 61 clínicas retornadas e renderizadas sem corte,
ordem/horários/datas preservados, limites antigos compatíveis, chamadas externas
bloqueadas e ausência de escrita nas consultas. Os testes de identidade,
cancelamento, troca de data/serviço e retry continuam aplicáveis. A homologação
instalada e os hashes de preservação serão registrados após conclusão; a
publicação em produção permanece fora desta autorização.

Validação local da lista completa: 252 testes Agenda passaram com SQLite
sintético; 30 testes frontend de oportunidades/regras passaram, incluindo
31 e 61 cartões; TypeScript sem emissão, ESLint focado, build Next.js e
`git diff --check` passaram. Nenhum banco operacional ou provider foi usado.

O primeiro ciclo validou a implementação em stage. O replay instalado foi
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

## Pacote isolado da regra original (preparação em 22/10/2026)

Este registro descreve a preparação histórica. A regra original foi publicada
pelo PR #418; a preparação posterior do P1 tem sua própria evidência abaixo.

A autorização posterior do usuário abrange publicar a regra regional e validar
a sexta-feira com Zoomare sem alterar agendamentos. A comparação de main
`c0639fc0c19434fcb38655ffdda44bd7c3f783df` com stage
`da7e38c6b0163f32404572c5dfe7229553f7e061` identificou incrementos pendentes de
Maps e divergência na documentação clínica. Esses conteúdos não fazem parte da
autorização desta publicação regional.

Foi preparado um branch local a partir desse main, aplicando somente a feature
`74c30c04463f889e3c028a9585410ad5687e3970` e sua evidência de stage
`01a2af9b5a7ace0e807a67a6168908972414ce0f`. A única resolução de conflito foi no
contexto dos endpoints de Agenda: incluiu-se `/oportunidades-dia`, mantendo de
fora o endpoint de geocoding de tutor pendente em stage. Não foi necessária
dependência adicional de Maps. A diferença resultante contém os 19 arquivos
regionais; custo/logística Maps, Axios, controles e demonstração de custo,
configuração de ambiente, modal de geocoding e documentação clínica permanecem
idênticos a main.

Validação do pacote isolado:

- 39 testes backend regionais e de normalização passaram, incluindo snapshot
  anterior à mutação do ORM, quota completa, margem, autenticação, histórico e
  quantidade constante de consultas de oportunidades.
- 28 testes frontend focados passaram nos componentes de oportunidades e nas
  regras normalizadas.
- O replay SQLite temporário passou os oito checks de sexta-feira, com zero
  chamadas Google e zero registros operacionais existentes modificados.
- `git diff --check` passou e a identidade dos arquivos de main que devem ser
  preservados foi verificada por comparação Git.

Esta preparação criou somente commits locais. Push, PR, deploy, ativação e
validação de produção ainda dependem do fluxo protegido da publicação.

## Limites da evidência

As clínicas, horários e durações são o recorte operacional mínimo do cenário já
apurado. Histórico individual de pacientes e contatos não é necessário. As rotas
reproduzidas não atualizam trânsito. A reprodução prova a regra aplicada pelo
código instalado em stage; ela não confirma clientes disponíveis nem cria ofertas
ou reservas reais.

## Decisão de release

- [x] Validação local concluída.
- [x] Publicado e validado em stage.
- [x] Autorizado para produção em 22/10/2026, limitado à feature regional.
- [x] Regra original publicada e validada em produção pelo PR #418.
- [x] Correção do P1 publicada e validada em stage pelo PR #420.
- [x] Correção do P1 autorizada para produção em 22/10/2026.
- [ ] Correção do P1 instalada e validada em produção pelo fluxo protegido.

## Correção do P1 do PR #418 — novo ciclo em 22/10/2026

O diagnóstico confirmou que o resolvedor de oportunidades lançava
`RotaSemEstimativa` para uma direção ausente, e o tratamento envolvia toda a
busca da clínica. Um candidato inicial sem rota podia ocultar candidatos
posteriores conhecidos; uma falha tardia também apagava os slots acumulados.
Trechos fixos desconhecidos abortavam o avaliador antes do contrato de ausência
explícita já suportado pelo helper. O resultado HTTP continuava com `ok: true`.

A correção mantém ausência como duração desconhecida, rejeita candidatos que
precisam dela antes de comparações ou somas e preserva os demais. O diagnóstico
`teve_rota_sem_estimativa` pertence à chamada do motor, sem ficar no contexto
compartilhado. O contador externo continua por clínica excluída; uma clínica com
slots conhecidos não entra nele. Desvio/custo direto desconhecido não ganha
valor estimado. O helper, limites e parâmetros de configuração não são alterados.

A autorização inicial permitiu integração e validação em stage. O canário
ampliado usa exclusivamente schema descartável e acrescenta direção C→B ausente
com B→C conhecido, além de baseline desconhecido com trecho final curto/longa
transição. O usuário autorizou depois publicar o P1 em produção e validar
Completar dia na sexta com Zoomare sem alterar agendamentos. Configuração, ENV,
mensagens e dados operacionais permanecem fora das mutações autorizadas.

Validação local deste ciclo, com SQLite sintético e providers bloqueados:

- Prova anterior ao fix: cinco regressões novas executadas; três falharam com
  `items=[]` nos casos positivos de ausência cedo, ausência tarde e baseline
  desconhecido. As duas guardas negativas já passavam.
- Após o fix: 12 testes do módulo de oportunidades passaram, incluindo seis
  regressões novas. O cache negativo compartilhado não perde o diagnóstico nas
  duas clínicas recusadas nem contamina a clínica normal seguinte.
- `python -m unittest discover -s tests -p 'test_agenda*.py'`: 249 testes passaram.
- Replay local `run_checks(engine)` em SQLite descartável: dez verificações
  integradas passaram, incluindo o caso C→B ausente que preserva C às 14h30 e
  baseline desconhecido que permite trecho normal mas recusa novo trecho longo.
- Frontend: 28 testes de oportunidades/regras passaram; TypeScript sem emissão
  e ESLint do componente/contrato passaram, sem mudanças de frontend.
- Sintaxe dos quatro arquivos Python e `git diff --check`: passaram.

O preflight daquela homologação de stage registrou SHA `4e6af331`, 64
agendamentos e hashes de bloqueios/configuração/matriz em transação READ ONLY;
guardou também hashes de ENV e seis arquivos runtime. Nenhum desses registros
ou parâmetros foi usado como fixture. A proteção de produção em `4c9a7865`
referia-se àquele ciclo anterior à autorização posterior descrita abaixo.

## Homologação instalada do P1 — PR #420

O PR #420 publicou o snapshot `f93a455f` em stage. O workflow
`39794689074` terminou com sucesso, e o replay instalado passou dez de dez
verificações em schema PostgreSQL sintético descartável. As provas incluem
direção C→B ausente preservando C às 14h30 e baseline desconhecido permitindo
trecho normal conhecido sem autorizar nova transição longa. O schema foi
removido, houve zero Google e os 64 agendamentos operacionais permaneceram
inalterados, assim como bloqueios, configuração, matriz e arquivos runtime.
No ENV mudou somente o identificador de release previsto pelo deploy; a linha
Maps e todos os demais bytes foram preservados.
CA-010, CA-011 e CA-012 estão concluídos por essa prova instalada, não somente
pelos testes locais. Não há critério de aceitação pendente para a promoção.

## Pacote isolado do P1 sobre main atual — 22/10/2026

O usuário autorizou publicar o P1 e validar Completar dia de 23/10 com Zoomare,
sem alterar agendamentos. O novo preflight, somente leitura, encontrou produção
em `4aa1364a96984af11b8e6dabbb7b209024935c43`, com `APP_ENV=production`,
autenticação Supabase e 1.580 agendamentos. A sexta agora contém duas âncoras:
Zoomare 09h–09h30 e Pet Sanus Caucaia 10h45–11h45. Esse snapshot é uma leitura
operacional, não fixture nem confirmação de demanda ou tempo atual de trânsito.

O commit `c351606ea2c40d565c9b82cd44529c08fedaf8af` já consta na ancestralidade de
main, mas sua correção não está no conteúdo atual. Por isso seu patch foi
reaplicado com `cherry-pick -x` sobre o main atual, sem copiar arquivos completos
do snapshot antigo. O pacote modifica somente os oito caminhos do P1. Maps,
PDFs, autenticação, workflows de SHA aprovado, migrations, ENV/configuração e
frontend permanecem idênticos a esse main; os incrementos clínicos pendentes em
stage não fazem parte da publicação autorizada.

As identidades Git do pacote comprovam backend e scripts idênticos aos de stage
`339c8013` e `d1e81bba`, e frontend idêntico ao main `4aa1364a`:

- backend: `ab5d23651d25477989caccb8d3e6db7bae736cbd`;
- scripts: `3cec1e9eb4b0f7e325b1615114c1aeb1859fc2bd`;
- frontend: `cea61c54a03ebdee2723bbb11ff495e444767a6d`.

A auditoria paralela do stage instalado
`d1e81bba026e6398e58f7ac5d010b6e698a33ea2` confirmou essas mesmas árvores de
backend/scripts e repetiu dez de dez checks, com schema removido e hashes de
ENV/fontes preservados. A prova sanitizada está no artefato local
`agenda-oportunidades-p1-production-stage-baseline-canary.json`. Não foi
necessário novo deploy ou alternância do frontend de stage para essa prova.

Validação local repetida no pacote isolado, sem banco operacional ou rede:

- 249 testes Agenda passaram com URL SQLite e chave sintética.
- 28 testes frontend de oportunidades/regras passaram.
- Dez de dez verificações do replay SQLite descartável passaram, com zero
  Google, zero pacientes/contatos copiados e zero registros existentes alterados.
- TypeScript sem emissão e ESLint do componente/contrato passaram.
- Sintaxe Python, guardrail SDD e `git diff --check` integram o fechamento local.

O fluxo protegido poderá reconciliar temporariamente o Git de stage para o
pacote isolado, preservando/restaurando os caminhos pendentes de outras sessões.
A identidade executável permite usar a homologação instalada sem alternar o
frontend clínico do runtime de stage. Não se usa dispensa de promoção com
pendência. Deploy terminal de produção e smoke autenticado/Completar dia são
evidências posteriores de publicação, não critérios de stage em aberto. Esta
preparação realizou somente commits locais; nenhum push, PR, deploy, consulta
SSH ou escrita em banco operacional foi executado nela.
