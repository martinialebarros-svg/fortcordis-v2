## Concorrência e homologação isolada — 24/10/2026

Teste de oito requisições HTTP simultâneas, pool de negócio com uma conexão, uma aquisição por requisição e zero conexões extras do planejador aprovado localmente. Sessão vinculada pela dependência real de banco, sem herança fora do escopo. Canário ampliado para 44 cenários.

O gate completo do workflow 40105177158 passou; a instalação foi interrompida na identidade WhatsApp de stage por número de teste não registrado na Meta, antes de instalar o código. Não tratar esse workflow como deploy bem-sucedido nem alterar a identidade para liberar Maps. Validar o SHA aprovado em checkout privado isolado na VPS de stage, com a mesma versão Python e banco de stage verificado, schemas descartáveis e zero transporte Google. Manter a aplicação operacional de stage intacta. Produção exige promoção protegida, workflow terminal, política efetiva, serviços e fonte instalada comprovados, sem teste pago.

# Registro interno da Agenda — validação de 24/10/2026

Escopo atual: retirar popups de custo da Agenda humana monitorada sem remover o ledger, os caps por execução, o cache prioritário ou os bloqueios de extras/automações. Referências financeiras existentes preservadas; nenhuma migração ou reset do histórico. Rollout explícito da flag de confirmação, com default seguro `true` e ativação `false` somente após prova instalada.

Validação cobre HTTP direto sem confirmar, cache sem ledger/plano, falha de ledger sem envio/commit, busca real sintética limitada ao período, plano indisponível sem fallback genérico, limite/prazo/reconexão, concorrência compartilhada, background sem herança, revisão de preços apenas como alerta e retorno reversível à confirmação. Os testes não simulam consentimento humano com chamadas automáticas a `/confirm`.

O canário instalado agrega onze cenários novos aos 32 anteriores, em schemas PostgreSQL descartáveis, transportes Google interceptados e sem modificar agendamentos operacionais. Instalação exige verificar SHA e política efetiva, além de runtime/dados preservados. A comprovação produtiva será somente leitura e não fará consultas pagas, prévias, confirmações ou agendamentos de teste.

O monitor deve distinguir o release e a flag de rollout: antes de `false`, `confirmation_required` pode ser o fluxo esperado; depois de `false` na Agenda monitorada, investigar novas ocorrências no fluxo humano. Observar também o painel Google usando sessão existente, sem chaves/credenciais novas ou mudanças de quota. Valores do Google, previsões e ledger permanecem separados e suas janelas explícitas.

Resultados locais e instalados deste ciclo serão registrados abaixo e no relatório privado; os resultados históricos seguintes não comprovam a nova política.

# Homologação do período concluída e promoção autorizada — 23/10/2026

Stage instalado `dde520a26bda6fbd69178130707950dae00d1696`, workflow `39949978355` terminal success e PR #456: 32/32 cenários PostgreSQL descartáveis, zero Google, zero alterações operacionais, zero schemas restantes. Casos de Hoje/intervalo, cache completo sem ledger, faltantes internos e primeira saída sem consultar âncoras externas aprovados. Frontend autenticado de stage conferido com demonstração fictícia e cancelamento sem consulta. Local: 353 testes Agenda/Maps, 35 frontend, tipos/lint/build/SDD aprovados; CI completa aprovada. Evidência privada em `maps-requested-period-stage/resultado-stage.md` e no corpo de #456.

Produção autorizada separadamente pelo usuário em 23/10, preservando a política atual. Antes de concluir: verificar os checks obrigatórios e deploy terminal do SHA exato, reinício dos três serviços, código instalado, política/ENV/runtime, plano do período em transação READ ONLY com transportes e reservas interceptados, chunks servidos e 401 sem credenciais. Zero chamadas Google ou agendamentos produtivos de teste. Registrar resultados na PR de promoção e no relatório privado. Restaurar no Git os caminhos paralelos de stage e confirmar que a aplicação instalada original e os dados/configuração foram preservados; cancelamentos Git-only não comprovam publicação produtiva.

# Período explícito — validação em andamento, somente stage (23/10/2026)

Provas exigidas: Hoje com rotas fora do período ausentes não aumenta a estimativa; intervalo explícito vence datas de referência/contato, janela de proximidade e políticas; faltantes dentro do intervalo são contados; cache completo dispensa popup/ledger; primeira saída continua limitada e discriminada; busca real sintética retorna ofertas dentro do período sem pagar por âncoras externas; cancelar não envia transporte, confirmar não libera replay; Agenda monitorada e extras/automações continuam protegidos. Popup exibe o período sem deslocamento de data por UTC.

Local concluído: 353 casos Agenda/Maps aprovados, 30 cenários PostgreSQL reservados a CI/stage e 96 subcasos; 35 testes frontend, TypeScript e ESLint aprovados. Quatro novos casos comprovam cache somente no período, intervalo que prevalece sobre referência/contato/políticas, faltantes dentro do intervalo e ofertas reais sintéticas sem novas rotas para âncoras externas. Cache de hoje com outros dias sem matriz retorna zero sem ledger; primeira saída isolada reserva no máximo duas tentativas, executa um transporte simulado e recusa replay.

Executar casos instalados em schemas PostgreSQL temporários, sem Google e sem alterações em registros operacionais. Confirmar o SHA e o deploy terminal de stage, dados/runtime/configuração preservados e produção sem alteração. Exemplos visuais usam apenas dados fictícios, pois os endereços de stage não representam a operação real. Registrar resultado local e instalado nesta seção antes da entrega; publicação em produção depende de nova autorização.

# Homologação concluída e publicação autorizada — 23/10/2026

Stage `d497ffb2` (#451), workflow `39891593361` terminal aprovado, junto com Frontend CI, Migration CI e orçamento Maps PostgreSQL. Canário instalado: 28/28, zero Google, zero alterações operacionais, zero schemas restantes. Matriz parcial: seis tentativas em vez do teto administrativo de 4.096; matriz completa: zero sem ledger/grant; busca real sintética com primeira saída: envelope de 12 e nenhum transporte duplicado. Cancelamento, concorrência, replay, limites e extras/automações preservados. 35 testes frontend, TypeScript, lint e SDD aprovados.

Os novos textos foram encontrados nos chunks servidos; a prévia isolada usa os mesmos componentes e dados fictícios, pois o navegador estava sem sessão de stage. Stage preservou dados, política e runtime. Produção #449 não foi alterada nessa homologação; a edição concorrente de um preset clínico foi identificada por PUT autenticado anterior ao deploy de stage e mantida. Evidência sanitizada em `/Users/martiniano/Documents/Codex/2026-10-22/maps-search-estimate-stage/resultado.json` e no corpo de #451.

A publicação produtiva deste incremento foi autorizada explicitamente em 23/10. Aguardar checks e deploy terminais, conferir SHA/API/worker/frontend, política efetiva, ENV, runtime, dados e bundle; nenhuma consulta Google ou agendamento produtivo de teste. Comparar dados sem apagar atividade concorrente. Registrar o resultado final na PR de promoção e restaurar os 27 caminhos paralelos de stage com deploy terminal.

# Estimativa por busca e alertas — validação de stage em andamento

Contrato: substituir o envelope genérico de 4.096 por máximo derivado do grafo de trechos possíveis e rotas válidas, distinguir consumo atingido de excesso projetado e manter Agenda monitorada/extras bloqueados. Não alterar produção neste incremento.

Local: 127 testes Maps executados, 97 aprovados e 30 skips de PostgreSQL reservado a CI/stage; 35 testes frontend Maps aprovados, TypeScript e lint sem erros. Busca real sintética de ofertas com primeira saída respeitou máximo calculado de 12 tentativas, sem duplicar transporte por trecho entre horários/dias. O cenário de matriz parcial reduziu o teto de 4.096 para seis tentativas; matriz completa retornou zero e não acessou o ledger. O canário de stage foi ampliado para 28 casos. Instalação e demonstração ainda pendentes.

Provas exigidas: preview sem Google/DML operacional; matriz antiga válida subtrai direções; cache completo sem grant/popup; primeira saída e alternativa após falha incluídas; execução real de ofertas respeita envelope e não duplica transporte entre dias/perfis; cancelamento sem envio, replay e excesso de confirmação recusados; indisponibilidade do plano sem fallback genérico; preço vencido apenas alerta na Agenda; lotes/automações sem nova autorização. Executar canário instalado em PostgreSQL descartável com schemas removidos, conferir SHA/workflow terminal/bundle de stage e preservar dados/configuração/runtime. Demonstração visual fictícia do componente real, sem Google ou agendamento de teste em dados operacionais.

# Matriz sem expiração automática por idade — 22/10/2026

- [x] Regressão antes do ajuste: uma rota sintética de dez anos tentava acessar o ledger e falhava com 503, em vez de reutilizar o cache.
- [x] Depois do ajuste: 119 testes `test_google_maps*.py`, com 30 cenários PostgreSQL reservados à validação CI/stage, sem falhas locais.
- [x] Rota antiga atende a escrita sintética de Agenda com ledger indisponível, sem transporte nem renovação de timestamps; localização alterada e fonte heurística continuam exigindo autorização de uma nova rota.
- [x] Lint, TypeScript, guardrail SDD e workflows do snapshot `0213c8f5` aprovados. Frontend CI passou na tentativa 2 após falha inicial em asserção Fiscal sem alteração nesse módulo; os 14 testes Fiscais também passaram isoladamente.
- [x] Canário instalado de Maps: 20/20 cenários PostgreSQL, incluindo os três novos de cache antigo, zero Google, zero alteração operacional e zero schemas restantes. Canário de frases repetido no mesmo SHA: 15/15 GETs 200, três conexões por rodada de três, zero checkouts extras.
- [x] API real informa `cache_expires_by_age=false`; bundle público `app/logistica/page-f7c484f932890ab3.js` contém “Sem expiração por idade”. Seis arquivos runtime, frases e configuração financeira preservados; produção permaneceu intacta durante a homologação.
- [x] Resultado apresentado e produção autorizada expressamente pelo usuário em 22/10/2026, mantendo Agenda com alertas e extras/automações bloqueados para novos envios pagos.

Evidência instalada: [workflow de stage](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/39878505947), PRs #442/#443. A promoção separa os sete caminhos clínicos/SDD pendentes e preserva sua restauração posterior em stage. A prova final produtiva será registrada no PR de promoção depois do deploy, com leitura de política efetiva, SHA, serviços, runtime, dados e smoke sem chamadas Google ou agendamentos de teste.

Os ciclos anteriores abaixo são históricos; a política de cache vigente está na seção “Matriz sem expiração automática por idade” do `spec.md`. As regras de consentimento, reserva financeira e bloqueio de extras permanecem preservadas.

# Verificação — Google Maps

## Endereço do tutor usado no agendamento domiciliar

O botão de georreferenciar endereço dentro da Agenda utiliza `POST /agenda/geocode-endereco-tutor`, ação registrada `agenda_tutor_geocode`, limitada a uma unidade Geocoding por confirmação e vinculada ao endereço exato. Como parte do agendamento humano, essa consulta pode ultrapassar referências em `monitor`, após consentimento. O endpoint cadastral avulso continua sujeito ao teto rígido. Não usar flag arbitrária de payload para promover lote a ação da Agenda. Testar tentativa sem token/cancelamento sem transporte, confirmação de uma unidade, replay negado e preservação da regra do endpoint avulso.

## Canário independente do fuso PostgreSQL

Datas dos agendamentos sintéticos usam `LOCAL_TZ` explícito. A leitura de horário no teste converte o timestamp para Fortaleza antes da comparação; não remover o fuso de um timestamp UTC e compará-lo com relógio local. A validação instalada inicial de `f948dd60` concluiu o update HTTP 200 sem Google e depois acusou diferença na asserção de horário (14h30 UTC versus 11h30 Fortaleza). Isso é falha do fixture/comparação, sem evidência de falha do agendamento ou bloqueio de custo. Repetir a suíte integrada com conexão PostgreSQL em UTC e com o fuso Fortaleza. Não alterar fuso do banco de stage para contornar a prova.

## Verificação do incremento — Agenda monitorada (stage)

Critérios: Agenda com cache segue sem Google/ledger; nova rota acima de referências diárias/mensais e custo por ação dos extras pode criar agendamento após confirmação finita; descartar/cancelar cotação não envia; replay e consumo além da confirmação falham; duas execuções simultâneas preservam reservas e alertas sem dupla contagem; tarefas automáticas e lotes não herdam a liberação. `cache_only` não aceita monitoramento. A opção administrativa não cria orçamento nem altera produção.

Testes em `test_google_maps_agenda_cache_first.py`, componentes Google Maps e canário instalado `scripts/google_maps_cache_first_stage_canary.py`. Canário usa recepção sintética, PostgreSQL em schemas novos isolados, transportes interceptados e remoção dos schemas; nunca criar agendamento real nem consultar Google para esta validação. Evidências desta entrega em `/Users/martiniano/Documents/Codex/2026-10-19/maps-agenda-monitor/`: testes locais, checks/merge, workflows, hashes de runtime, smoke HTTP/bundles e canário instalado. O registro final só pode declarar aprovação após esses checks. Valores dos testes/demonstração são fictícios. Não considerar CI local ou SHA do checkout sozinho prova de publicação.

## Incremento vigente — cache primeiro, validação de stage em andamento

Código preparado para rollout apenas em stage. Produção permanece na liberação temporária; nenhuma nova ativação financeira ou quota Google é autorizada por esta verificação.

Local: suíte Maps com PostgreSQL descartável aprovou 100 casos sem skips (inclui concorrência/replay/providers legados e casos novos). Os dez cenários novos de Agenda também foram executados separadamente com schema traduzido e search_path isolado em PostgreSQL, todos aprovados. Criar agendamento sintético com cache retornou HTTP201 e persistiu o registro, mesmo sem ledger disponível. A tentativa sem consentimento sobre cache vazio retornou 409 antes do transporte e sem commit/notificação; confirmação de uso único permitiu duas pernas reais do código com HTTP simulado. Replay foi recusado e o uso permaneceu contabilizado.

Frontend: 29 casos Maps focados aprovados e quatro casos do formulário real de reserva aprovados (dois novos de preservação após cancelamento/limite), incluindo cache, cancelamento após tentativa local, payload exato, repetição limitada, preview indisponível, saldo esgotado, concorrência e demonstração sem API. TypeScript e ESLint aprovados. O preview local tem timeout de 3 segundos com continuidade sem token; estimativa paga/confirm usam 15 segundos e falham sem autorizar transporte. Os 29 casos Maps foram repetidos após esse ajuste e passaram. A primeira execução de um caso legado ainda esperava bloquear toda a Agenda quando o preview falhava; foi atualizada para comprovar a suspensão de lote. O caso específico da Agenda comprova o novo comportamento. Uma asserção de criação foi corrigida de HTTP200 para o HTTP201 real; não houve falha do fluxo.

Build de produção aprovado; 1.062 testes Vitest e 23 testes Node aprovados. O comando inicial npm test com argumento de concorrência passou o argumento indevidamente ao Node, que o recusou; os 23 testes Node foram então executados separadamente e passaram. A suíte backend ampliada aprovou 2.019 casos/74 skips no snapshot anterior ao último caso adicional de criação; esse caso está incluído na suíte final de 100 testes Maps/PostgreSQL aprovada. CI executará novamente o head final. A publicação ainda precisa de resultado instalado. `scripts/google_maps_cache_first_stage_canary.py` exige checkout/SHA/APP_ENV/projeto stage, política operacional paga desligada e flags efetivas. Usa somente schemas temporários, DML traduzido e search_path local por transação, transportes interceptados e limpeza obrigatória. A prova instalada é registrada depois do deploy; testes locais não são publicação.

A demonstração e os testes não implementam o cadastro persistente de solicitação pendente. O comportamento com rota inédita e orçamento esgotado será revisado com o usuário antes da reativação; não prometer confirmação universal sem dados de rota.

## Liberação operacional confirmada em produção — 19/10/2026

Produção `ac054398` (PR #399): API reiniciada às 13:26:57 UTC e worker às 13:27:27 UTC, ambos após preparar `GOOGLE_MAPS_COST_EMERGENCY_RELEASE=true` às 13:17:05 UTC. Smoke autenticado às 13:28 UTC confirmou `temporary_open`, `blocked=false`, `paid_calls_allowed=true` e limites/custo desconhecidos, sem teto fictício. O serviço não tinha override de ambiente conflitante; worker foi verificado pelo diretório/processo e reinício após a configuração, enquanto a API teve status relido via HTTP.

Perfil real de recepção, token efêmero mantido em memória: previews de criação e sugestões retornaram HTTP200/required=false; POSTs com corpo vazio retornaram HTTP422 exclusivamente por campos obrigatórios (`inicio` e `data`). Isso comprova que o bloqueio financeiro foi removido e a autenticação permite chegar à validação normal; não é alegação de agendamento real criado. Sem token, status continua HTTP401. Nenhum payload válido de negócio ou consulta de teste Google foi enviado. Os seis hashes operacionais permaneceram iguais ao preflight. A primeira sonda ocorreu durante a instalação e não completou; a repetição posterior aos reinícios passou.

Evidência: `evidence/production-emergency-live-smoke.json`. Na hora dessa sonda, a instalação visual/pipeline ainda estava em execução; sua conclusão e o smoke do bundle são verificados separadamente, sem transformar este resultado em prova antecipada de deploy terminal. Cotas Google zero e ativação cache_only não foram realizadas.


## Reintegração do hotfix e restauração de stage

A PR #399 integrou o hotfix operacional em produção (`ac05439819fc4b8ba65bb699f7edfab669cfd00e`). A flag foi preparada em produção, preservando as demais variáveis; sua efetividade exige API/worker reiniciados e prova autenticada. A reintegração em stage inclui o mesmo hotfix e restaura exatamente os 13 caminhos clínicos do snapshot de stage `cb93d4c6`, que haviam sido retirados temporariamente para isolar a promoção Maps. Essa restauração é somente stage; não altera o conteúdo clínico de produção. Conferência dos 13 caminhos exatos aprovada, assim como 80 testes clínicos focados e TypeScript. Evidência: `evidence/clinical-stage-restoration.json`.

A validação anterior do modo R$ 0 em stage (`f0009e40`) está preservada nos cinco arquivos `evidence/stage-zero-charge-*.json` e `evidence/zero-charge-stage-workflows.json`: deploy terminal, 1.991 testes backend/70 skips no CI, 74 testes Maps PostgreSQL, canário isolado com quatro transportes simulados em oito concorrentes, uma recusa por limite e três por capacidade de conexão. A API operacional de stage ficou sem configuração aprovada; não confundir o canário PostgreSQL isolado com ativação da política no banco operacional. As provas são históricas: o usuário suspendeu a ativação R$ 0 após relatar interrupção da Agenda.


## Hotfix operacional de 19/10/2026

Pedido vigente: liberar temporariamente os agendamentos, suspendendo bloqueios financeiros Maps. Diagnóstico readonly da produção `21035136`: guard sem configuração, revisão 0, motivo `unconfigured`. A tentativa anterior de ativar cache_only parou no preflight antes da gravação; cotas zero não foram aplicadas.

Backend emergencial: 11 testes aprovados, sem Google real. Cobrem API com cache vazio e rota simulada, cache reaproveitado, primeira saída, três provedores, tarefa automática, autenticação negada, SKU desconhecido, revogação da flag e preservação do ledger.

Regressão local: 85 testes Maps aprovados (25 skips de PostgreSQL opcional não configurado nesta execução), mais 10 testes de atomicidade Agenda aprovados. Os 11 casos emergenciais não tiveram skips. Revisão independente não encontrou bloqueante.

Frontend local: 18 testes Maps aprovados, TypeScript e ESLint aprovados. O caso novo libera a ação sem popup/token com máximos nulos; o painel mostra cobrança possível e oculta formulário de orçamento ineficaz. Nenhuma chamada Google real.

A prova deste hotfix cobre liberação sem grant/ledger, três provedores com transporte simulado, tarefas automáticas, manutenção de autenticação, retorno ao bloqueio quando a flag é desligada e ausência de limites/custo zero fictícios. Publicação e ativação são comprovadas separadamente após a integração; testes não são prova de instalação. As seções anteriores abaixo são histórico do ciclo de proteção, cuja ativação de custo zero foi suspensa pelo usuário.


Status do incremento atual: produção Maps autorizada com gasto adicional zero; `cache_only` implementado e aprovado nas suítes locais integrais de backend e frontend, além dos testes focados. Configuração efetiva, publicação e prova do novo modo em stage/produção permanecem **pendentes**. Os resultados do ciclo anterior, preservados abaixo, não provam o novo modo nem publicação em produção.

## Decisão e observações anteriores à publicação do modo R$ 0

- O usuário autorizou produção sem ultrapassar o teto gratuito. Decisão: `operation_mode=cache_only`, zero novos envios Google; usar somente rota Google persistida ainda válida ou override manual já autorizado. `paid_budget` não está autorizado para ativação nesta promoção.
- Console Google autenticado observado em 18/10/2026 às 21:41 UTC: a conta mostra somente o projeto `fortcordis-maps`; relatório de 1–18/10 registra Routes Compute Routes Essentials 6.114 / R$ 0 e Geocoding 21 / R$ 0. O inventário de projetos é atual, não histórico. Não declarar 3.886 chamadas como saldo gratuito verificado: Billing pode chegar com atraso e o uso de quota diária não é o ledger mensal.
- Quotas observadas: Compute Routes por dia ilimitado, Compute Route Matrix por elemento/dia ilimitado, uso atual exibido zero; limite por minuto observado 3.000. Nenhuma quota foi alterada até essa coleta. Um formulário com valor zero foi preparado e cancelado, o que não aplica bloqueio. Avaliar limites nativos zero depois da proteção em produção continua **planejado**, sujeito à comprovação do valor efetivo por API/métrica.
- SQL readonly às 18:36 de Fortaleza: produção `9137d39f` contém 5.934 registros Routes `routes_api_basic/ok` em outubro; stage `cb93d4c6`, zero. Hoje, zero registros nos dois. A diferença de 180 para o relatório Google não foi conciliada nem atribuída a um defeito. Geocoding/primeira saída e persistência da telemetria têm lacunas conhecidas.
- `created_at` real é `timestamp without time zone DEFAULT CURRENT_TIMESTAMP`; a sessão consultada está em UTC. O agregado supondo UTC→Fortaleza e o agregado bruto mantêm 5.934 no mês, mas não provam o fuso histórico. A franquia mensal Google reinicia às 00:00 do Pacífico dos EUA no primeiro dia, enquanto o ledger operacional usa Fortaleza.
- Produção ainda não tinha tabelas do guard na coleta; stage tinha zero configurações e somente bloqueios, sem reservas. Esses dados descrevem o estado anterior à nova publicação, não sua conclusão.
- Os 13 caminhos clínicos restaurados pela PR #391 foram isolados no candidato local, iguais à produção `9137d39f`. Restaurá-los em stage a partir de `cb93d4c6` depois da promoção continua obrigatório. A alteração de payload clínico/avisos felinos não integra a autorização Maps.
- Evidências sanitizadas: `evidence/console-free-ceiling-20261018.sanitized.json`, `evidence/october-application-usage-20261018.sanitized.json` e `evidence/clinical-isolation-for-maps.json`. A auditoria histórica em `audit.md` permanece um retrato anterior à implementação.

## Aceitação do incremento `cache_only` — local versus instalado

| Verificação | Estado |
|---|---|
| Configurar sem preços/FX/baseline; limites zero; preservar eventos e baseline anterior sem inventar consumo | Local aprovado; instalação pendente |
| Preview `required=false`, sem quote/token/popup pago; uso de rota Google válida/manual sem transporte | Local aprovado; instalação pendente |
| Cache ausente, expirado, heurístico, TTL não positivo, manual sem override e primeira saída sem TTL bloqueiam com motivo; agenda preservada | Local aprovado; instalação pendente |
| Acesso direto, jobs, force refresh e todos os providers não enviam Google; falta de key/flag não libera fallback, mudança de modo revalida a política | Local aprovado; instalação pendente |
| Concorrência/reconexão/banco indisponível não abrem autorização; regressão `paid_budget` preservada | Local aprovado em SQLite/PostgreSQL descartável; instalação pendente |
| Testes frontend, painel sem campos financeiros fabricados, bloqueio visível, build e regressões | Local aprovado; bundle instalado pendente |
| Gates e deploy terminal em stage do novo modo, transporte simulado e dados sintéticos | Pendente |
| Promoção isolada stage→main; runtime preservado; configuração cache-only relida e smoke instalado sem Google real | Pendente |
| Segunda barreira nativa com valores efetivos comprovados e restauração dos 13 caminhos em stage | Pendente |

## Resultados locais do incremento `cache_only` — 18/10/2026

- Backend focado: 74 testes Maps, sem skips, incluindo PostgreSQL descartável e prova do canário com API real/banco isolado; mais dez casos Agenda/IA de atomicidade, 26 de primeira saída e dez de logística, todos aprovados. Incluem atualização de modo, cancelamento/replay pago, providers/jobs negados, histórico preservado, TTL não positivo, fonte manual sem override e cache de sessão da primeira saída sem validade verificável. As contagens são de conjuntos executados, não uma soma livre de sobreposição com a suíte integral.
- Suíte integral backend do candidato clínico isolado: **1.991 testes, 69 skips, zero falhas/erros, 94,142 s**. A primeira execução final teve 24 erros porque fixtures antigas de Agenda não criavam as tabelas/engine do controle compartilhado; as fixtures passaram a usar ledger SQLite vazio isolado e cleanup de engine. Após isso, 208 testes Agenda e 20 WhatsApp Opções passaram e a suíte integral foi repetida com sucesso. O guard permaneceu exigindo validade verificável para primeira saída, sem afrouxar o bloqueio.
- Frontend: 980 testes Vitest em 107 arquivos e 23 testes Node aprovados, com dois workers; 20 testes focados Maps, ESLint, TypeScript e build aprovados. Uma primeira execução ampla encontrou quatro timeouts de 5 s em testes fora de Maps; a repetição com concorrência reduzida passou sem mudança no código. Os casos novos comprovam payload zero sem preços/FX/baseline, preservação do histórico, troca para pago com valores explícitos, preview sem popup/token e bloqueio de cache sem repetir/confirmar.
- Revisão independente do script operacional local de ativação: payload mínimo, validação de destino/SHA, rejeição de configuração paga habilitada, revisão otimista, recarga independente, tripwires dos três providers, HTTP sintético negado, snapshots agregados e hashes dos seis arquivos de runtime. Somente análise estática/AST; o script **não foi executado** e não prova configuração em produção.
- Os testes usam dados sintéticos e transportes interceptados. Não houve envio Google para validar esse incremento local. Resumo sanitizado e hashes dos logs em `evidence/cache-only-local-validation.json`; os logs integrais ficam fora do Git.

## Evidências de entrada

- Billing fornecido pelo usuário, projeto `fortcordis-maps`, SKU Routes: Compute Routes Essentials: julho 13.062 / R$ 90,12; agosto 22.806 / R$ 372,45.
- Evidência original privada permanece fora do Git; diagnóstico sanitizado em `audit.md`.
- Código base stage `74f0148c`; produção observada readonly `9137d39f`.

## Casos obrigatórios do controle pago preservado

- Cancelamento/abort do popup não executa ação; confirmação não é lembrada.
- Concorrência de reservas em SQLite e PostgreSQL descartáveis; persistência/replay.
- Limite por ação/dia/mês e custo conservador por SKU; política automática própria.
- Chamadas reais dos três providers interceptadas antes do transporte; zero rede nos testes.
- Erros de orçamento não causam fallback Distance Matrix nem heurística.
- Cache: uma consulta sintética renova registro expirado de valores idênticos e outra sessão reutiliza sem consulta.
- Permissões administrativas, vínculo de usuário/payload e política ausente/expirada.
- Build/lint/frontend, regressões backend, migração aditiva, guardrail SDD.

## Limites da prova

Uma reserva paga anterior à troca para `cache_only` pode já ter passado pela checagem e estar em trânsito. Trocar o modo não cancela retroativamente esse transporte. A primeira ativação exige verificar guard inicialmente sem orçamento habilitado, deploy/reinício dos processos no snapshot aprovado e estado efetivo da segunda barreira nativa quando aplicada. SHA do checkout sozinho não atesta todos os workers vivos. Nenhuma dessas etapas está comprovada por testes locais.

Mocks provam envio/cancelamento no transporte da aplicação, não tarifação real do Google. Nenhum teste deve enviar uma chamada paga ao Google. Métricas antigas não trazem action_id; o defeito do cache é reproduzido, mas não autoriza atribuir toda a diferença histórica à mesma causa. Quotas nativas só podem ser consideradas ativas após verificar o projeto no console. SQLite comprova invariantes do núcleo; com a transação operacional aberta, sua contenção de escrita pode bloquear uma segunda reserva por indisponibilidade do ledger. A pilha operacional de stage/produção usa PostgreSQL; sucesso integrado com múltiplas pernas deve ser provado nesse banco.

## Resultados locais do primeiro ciclo — 18/10/2026, anteriores a `cache_only`

- Núcleo de orçamento: 40 testes em SQLite e PostgreSQL 16 descartável, todos aprovados. Incluem seis processos simultâneos com teto de duas reservas e oito claims concorrentes com somente um aceito, replay/reabertura de conexão, saldo inicial imutável, permissões, falha do banco, limite por SKU, mensal independente do diário e política automática própria.
- Providers/cache: cinco testes aprovados, incluindo bloqueio antes dos três transportes, ausência de fallback pago, mensagens sem chave/endereço, TTL renovado para valores idênticos e override manual preservado.
- Agenda e IA transacionais: dez casos aprovados com HTTP/DB sintéticos, duas pernas e bloqueio na segunda, cobrindo clínica/domicílio, reativação, reabilitação, preparação/aprovação pela IA e sucesso. Reload confirma ausência de alteração parcial; validação de oferta propaga bloqueio financeiro em vez de anunciar indisponibilidade genérica.
- Integração PostgreSQL real: dois casos adicionais exercitam API Agenda, middleware, preview/confirmação, duas pernas de rota e ledger real. Sucesso confirma negócio/cache juntos; limite na segunda perna mantém agendamento original e cache vazio, com a primeira reserva financeira persistente após reconexão. Um observador independente prova reserva anterior ao transporte e ausência de commit parcial. Zero Google.
- Suíte backend integral final: 1.962 testes em 96,477 s, 44 skips, zero falhas, mais os dois testes integrados PostgreSQL adicionados ao fechamento. Uma execução anterior usou SECRET_KEY sintética com menos de 32 caracteres e falhou em três fixtures do worker; corrigido o ambiente de teste, sem reduzir a validação de segurança. A suíte final usou chave sintética válida.
- Frontend: 1.042 testes Vitest e 23 testes Node aprovados; build de produção, TypeScript e ESLint aprovados. Casos focados incluem cancelamento/abort, erro de preflight, replay, fila de popups, config explícita e geocodificação apenas por ação.
- Migrações: ciclo up/down/up SQLite aprovado; migração 99 testada idempotente/aditiva e RLS/revogação PostgreSQL.
- Navegador real com API sintética e hosts externos bloqueados: cancelar em Logística e Agenda enviou zero operações originais; popup acima do modal real; painel desktop/mobile sem overflow horizontal nem erro JS. Rodapé mobile corrigido e revalidado: Cancelar/Confirmar permanecem visíveis. Evidência em `evidence/browser-synthetic.json` e imagens `.synthetic.png`.

O JSON de auditoria agregada foi coletado readonly de produção/stage. Nenhuma chave, endereço ou dado clínico foi versionado.

## Validação de stage — snapshot `53307512`

- [PR #392](https://github.com/martinialebarros-svg/fortcordis-v2/pull/392) integrado em stage; [deploy 39164041129](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/39164041129) concluído com sucesso. Migração 99 aplicada; arquivos de runtime preservados/restaurados e `Backup restore drill OK`.
- Quality gate: 1.964 testes backend, 67 skips no ambiente CI; etapa específica PostgreSQL executou 47 testes sem skips/falhas. Frontend CI, Migration CI, Google Maps Cost Control e SDD concluídos com sucesso.
- Checkout stage conferido `53307512d361e1259562d256fc2a9d8f8ab08a67`; produção permanece `9137d39fea18c795bb1cb7b1cc9bc204dce05d69`. Não houve publicação em produção.
- HTTP: `app.stage.fortcordis.com.br`, `stage.fortcordis.com.br` e `www.stage.fortcordis.com.br` retornaram 200 na rota de Configurações, com aliases redirecionados ao canônico. API administrativa sem autenticação retorna 401. Fluxos de preview/confirm/status e botão de confirmação encontrados entre os 15 chunks servidos.
- Navegador com bundle real de stage e todas as APIs substituídas por fixtures: 27 assets reais, 44 requests de API simulados, dois previews, zero confirmações e zero ações enviadas após cancelar. Popup acima do modal real de Agenda, botões mobile visíveis, sem overflow ou erro JavaScript. Nenhuma API real ou Google foi chamada nesse teste de UI.
- Evidências sanitizadas: `evidence/stage-workflows.json`, `evidence/stage-http-smoke.json`, `evidence/stage-browser-synthetic.json`.
- A primeira execução do canário concorrente interrompeu por `ledger_unavailable` ao abrir conexões no banco remoto. A política bloqueou as operações; esse resultado não foi contado como prova de sucesso do canário. O diagnóstico e a repetição controlada são registrados na evidência final do canário.
- Repetição controlada do canário, com candidato executado em memória sobre o código implantado: oito reservas concorrentes, quatro envios simulados e quatro recusas `ledger_unavailable`; diagnóstico sanitizado `connection_capacity` na abertura de conexões. Nenhum preenchimento sequencial foi necessário. A tentativa seguinte retornou `day_limit`; replay retornou `invalid_grant`; tarefa sem política retornou `automatic_policy_required`. Uso persistiu após reconexão. Zero Google real, zero alteração em registros operacionais existentes, zero schemas temporários restantes. Evidência: `evidence/stage-canary.json`.
- O ajuste do canário separa claim de autorização da disputa de reservas e registra indisponibilidade como recusa, sem alterar o guard, timeout ou limite. Cinco testes aprovados garantem que excesso real, motivo inesperado ou diagnóstico inseguro continuam reprovando a prova. A falha de capacidade observada neste teste não é atribuída ao aumento histórico de julho/agosto.
# Preparação de 21/10/2026

Proposta desabilitada validada no contrato `CostConfiguration`; 32 testes dos componentes Maps, TypeScript e lint passaram localmente. A suíte cache-first executou 21 testes, com 16 aprovados e 5 skips esperados sem PostgreSQL local. O novo cenário aplica a proposta em banco sintético acima das referências e prova alteração de Agenda, confirmação finita/replay bloqueado e extras/automação suspensos. A emissão de token do canário usa cleanup compatível com o helper de autenticação atualizado. Após deploy, executar os 12 casos instalados de recepção em PostgreSQL isolado com transportes interceptados; conferir SHA, runtime e processos stage. Produção somente leitura, com dry-run de ambiente válido, sem aplicar configuração. Evidência atual: `/Users/martiniano/Documents/Codex/2026-10-21/maps-activation-preparation/`. Endereços fictícios/incompletos de stage não comprovam trajetos reais nem saldo Billing; nenhuma configuração financeira operacional é habilitada neste ciclo.

Em 22/10, stage `e50192cb` concluiu deploy e os 12 cenários instalados de recepção passaram, sem Google ou alteração de registros operacionais e sem schemas restantes. O rascunho foi salvo para revisão na configuração de stage, revisão 1, `enabled=false`; nenhum orçamento pago foi habilitado. Três domínios responderam 200 à página autenticada, API administrativa anônima 401, marcadores presentes nos chunks servidos após normalizar escapes JS. Os seis arquivos de runtime foram preservados. Produção permaneceu `ac054398`, API `temporary_open`, configuração financeira ausente e checksum do ambiente inalterado. A etapa de privacidade seguinte remove pagamentos reais do componente compilado; validar novamente o componente e sua ausência nos assets publicados. Plano de transição em `activation-cutover.md` evita contabilização incompleta entre baseline e encerramento da emergência.

## Ativação autorizada em 22/10/2026

O usuário autorizou produção com referências de 650 chamadas/R$ 25 por dia e
13.000 chamadas/R$ 500 por mês, mantendo a Agenda em `monitor`.
`approved-monitor-config.json` registra o template selecionado, ainda desabilitado
e sem baseline: não aplicar como configuração ativa sem a coleta de transição.
Todas as ações não Agenda ficam com teto zero e automações sem política habilitada.
A Agenda usa cache primeiro; novas chamadas exigem confirmação individual e finita.
As referências não interrompem a Agenda; estimativa não equivale à fatura Google.
O consumo histórico não conciliado será identificado como incompleto, sem saldo
gratuito presumido, e não permitirá reabrir extras. Manter a expiração dos preços
visível e revalidar até 21/11/2026.

A correção regional de oportunidades do PR #420, autorizada somente em stage,
fica temporariamente fora do snapshot de promoção e será restaurada em stage
após a publicação. Preservar o código regional e a autenticação já em produção.

A transição manual usa `maps-production-activation.yml`, exclusivamente a partir
de main, com SHA instalado exato e ambiente production. O script compartilha o
lock de deploy, usa a credencial sudo somente em stdin e encerra API/worker antes
do baseline. A apuração usa o máximo entre fontes sobrepostas como piso observável,
nunca como total conciliado ou limite superior. O painel explicita a incompletude
histórica; todos os extras permanecem com teto zero independentemente do saldo.
A estimativa inicial reserva tarifa cheia, sem créditos, usando o SKU Essentials
observado. Novas tentativas usam a reserva do SKU efetivamente autorizado.
Falhas da transição restauram emergência e reiniciam API/worker, preservando ledger.

## Stage instalado — ativação autorizada de 22/10/2026

Stage `097227a5` concluiu todos os workflows necessários. A suíte backend executou
2.089 casos (com skips esperados documentados no log); a suíte Maps/PostgreSQL
executou 110 casos. O canário instalado comprovou os 12 cenários como recepção
sintética sem autoridade administrativa, com zero Google, zero agendamentos
operacionais alterados e nenhum schema temporário restante. O smoke autenticado
da configuração respondeu 200 nos três hosts de stage; API administrativa sem
credencial respondeu 401. Marcadores verificados nos chunks, sem pagamentos
históricos reais no JavaScript. Os seis arquivos de runtime foram preservados,
restaurados e conferidos por hash; backup/restore drill aprovado.

A PR #422 integrou somente os 41 caminhos Maps e do operador de ativação em
main `1a7cd0aa`. A instalação e ativação efetivas precisam do smoke instalado
e da transição drenada, não apenas do merge. Evidência privada sanitizada em
`/Users/martiniano/Documents/Codex/2026-10-22/maps-production-activation/`.

## Revisão de preços/câmbio sem corte da Agenda — 22/10/2026

Por autorização explícita, `pricing_valid_until` funciona como data de revisão
para as ações humanas registradas da Agenda em modo `monitor`. Vencer a data
(inclusive 21/11/2026) gera `pricing_review_due`, sem impedir cotação, confirmação,
execução ou reserva de tentativa. Manter preços, câmbio, margem e data originais;
não prolongar a data nem apresentar a estimativa antiga como tarifa atual verificada.
O aviso aparece no painel administrativo, na cotação/popup e no histórico (uma
vez por execução, sem duplicar consumo). Quantidade máxima, custo estimado da
confirmação, SKU, usuário/payload, validade do consentimento e revisão continuam
verificados. Nenhuma alteração nos limites autorizados, no baseline ou nas flags
de produção é necessária para publicar esta correção.

A exceção não habilita lotes, consultas extras, políticas automáticas ou modo
`enforce`, que continuam recusando preços vencidos. Cache primeiro permanece
sem cobrança. Ledger indisponível, configuração inválida/desabilitada, falta de
confirmação, replay, expiração do consentimento e excesso por ação continuam
suspendendo apenas a operação paga correspondente. Não inventar rotas ou horários.

Verificação: cinco novos cenários incluem update real do endpoint com transporte
interceptado e revisão vencida, cancelamento sem envio, alerta sem custo duplicado,
geocoding domiciliar de uma unidade, virada da data entre cotação/confirmação/envio,
expiração própria do consentimento, concorrência de confirmações finitas e suspensão
administrativa preservada. O canário instalado de recepção agrega esses cenários
em PostgreSQL isolado, sem Google ou agendamentos operacionais. A publicação exige
workflows terminais, smoke dos assets e confirmação de que configuração/consumo
existentes foram preservados.

A promoção desta correção isola os incrementos regionais/PDF e o gate de stage
que ainda não estão em produção. O patch desses caminhos fica preservado para
restauração imediata em stage após o deploy. Não promover nem reverter funções
clínicas ou autenticação incidentalmente. A configuração ativa revisão 1 permanece
inalterada; publicar código sem repetir o operador de ativação inicial.

O popup explicita “Estimativa desatualizada — revisão pendente” e a data
no fuso Fortaleza. “Confirmar esta ação” continua habilitado; abrir o aviso
não despacha a ação, e confirmar produz uma única autorização. O título
geral “Agenda liberada com alertas” não presume que o orçamento já foi excedido.

## Revisão vencida validada em stage — 22/10/2026

O deploy `39836185306` terminou com sucesso em stage `82f2e781`. Os quatro
workflows exigidos passaram; 17 cenários instalados de recepção passaram em
PostgreSQL isolado, com zero Google, zero agendamentos operacionais alterados
e nenhum schema temporário restante. Os cenários novos cobrem revisão vencida,
virada da revisão durante confirmação, geocoding de uma unidade, concorrência
e suspensão administrativa preservada. Os seis arquivos de runtime mantiveram
os hashes. A página autenticada respondeu 200 nos três hosts de stage, API
administrativa anônima 401 e os 16 chunks servidos contêm os avisos novos.

Validação local: 115 testes Maps (85 aprovados, 30 skips esperados sem PostgreSQL),
34 testes dos quatro componentes Maps, lint, TypeScript e SDD. CI PostgreSQL
compartilhado aprovado. O head `a93c4b04` acrescentou apenas dois registros
`verify.md` de PDF/gate; aplicação, testes, scripts e workflows foram conferidos
como idênticos ao stage instalado. Seu redeploy documental foi cancelado e não
foi contado como instalação. O check inconsistente de orçamento compartilhado
(workflow concluído com todas as etapas aprovadas, job ainda em andamento na API)
foi repetido: tentativa 2 de `39837904041` terminou com sucesso, sem bypass.

A PR #432 promoveu o snapshot em main `3553c461`; a publicação efetiva requer
workflow terminal e smoke instalado. Não reexecutar a ativação inicial: configuração
e abertura financeira da revisão 1 devem permanecer idênticas. O registro final
privado e sanitizado está em `/Users/martiniano/Documents/Codex/2026-10-22/maps-price-review-alerts/`.
