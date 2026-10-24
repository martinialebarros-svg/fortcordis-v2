# Agenda com registro interno e monitoramento do Google — 24/10/2026

Pedido operacional atual: suspender os popups de custo a cada consulta da Agenda, registrar internamente e continuar o monitoramento, agora também com observação direta do painel Google Maps. Esta decisão substitui a exigência histórica de consentimento interativo somente para ações humanas registradas da Agenda em `monitor`. Não autoriza liberar extras, automações ou alterar as referências financeiras. Validar em stage com transporte interceptado antes da aplicação controlada em produção.

- IR-001: `GOOGLE_MAPS_AGENDA_REQUIRE_CONFIRMATION=true` é o default e rollback. Ativar `false` explicitamente no servidor, em conjunto com cache primeiro e política persistida `monitor`, para retirar a confirmação por popup. Não usar emergência nem instrução/header do cliente como autorização. `enforce` preserva confirmação interativa.
- IR-002: cache válido continua prioritário e pode atender sem ledger nem planejamento de chamadas pagas. Somente no primeiro transporte necessário da requisição autenticada, o servidor calcula o envelope pertinente ao período solicitado, sem enviar Google. A sessão de planejamento fecha antes da transação independente do ledger. Cada reserva continua anterior ao transporte.
- IR-003: criar uma execução `claimed` limitada ao HTTP atual, ao usuário e ao HMAC dos parâmetros, com SKUs, chamadas e custo máximos finitos, revisão e prazo de execução. Registrar `internal_authorized/agenda_internal_record`; não criar eventos `confirmed`, token de consentimento ou autorização permanente. Repetir uma requisição constitui outra execução registrada; não reutiliza a anterior.
- IR-004: o máximo é o menor dos caps existentes, teto teórico quando aplicável e grafo da busca. Reutilizar resultados no escopo da execução. Não recorrer a 4.096 quando o grafo não pode ser verificado. Falha do ledger/plano suspende somente o envio pago e é informada na tela; não inventar rota, duração ou disponibilidade.
- IR-005: manter referências de 650 chamadas/R$25 por dia e 13.000/R$500 por mês como alertas da Agenda, com seis caps de extras zero e nenhuma política automática habilitada. Não alterar preços, câmbio, consumo inicial, quotas ou configuração financeira. Revisão vencida gera alerta interno; não suspende a Agenda monitorada. Alertas de custo ficam no painel administrativo/histórico, sem novo popup ou banner a cada execução.
- IR-006: fechar o escopo antes de tarefas em background. Uma política automática continua obrigatória e não herda o pedido humano. Revalidar antes de todo envio; concorrência, reinícios, expiração e excesso de cap não liberam chamadas extras. A desativação administrativa e o modo cache-only continuam autoritativos.
- IR-007: `/status` informa `agenda_confirmation_required`. O painel administrativo distingue registro interno de confirmação humana e mostra consumo/limites/histórico; o frontend não confirma silenciosamente tokens em nome do usuário. O mesmo comportamento vale para requisições diretas autenticadas, sem depender do navegador.
- IR-008: o monitor continua somente leitura até 29/10, com fontes separadas: ledger interno estimado, métricas de requisições do projeto Google e relatório Billing por SKU/conta/projeto/período. Guardar apenas agregados privados, sem chaves, contatos, endereços ou payloads. Registrar janela/fuso, atraso, fonte e limitações. Não tratar custo direcional/previsão/estimativa como fatura nem pressupor saldo gratuito. Não somar as mesmas chamadas entre fontes.

Rollback operacional: restaurar `GOOGLE_MAPS_AGENDA_REQUIRE_CONFIRMATION=true` e reiniciar API/worker; isso volta ao fluxo interativo nas novas requisições. Não restaurar banco, ledger ou cache. As seções seguintes preservam histórico; menções anteriores a popup obrigatório e autorizações por ambiente não substituem este escopo atual.

# Publicação autorizada do período explícito — 23/10/2026

Após apresentação do stage `dde520a2` (PR #456), o usuário autorizou publicar somente esta correção: estimativa limitada à preferência de datas, matriz válida primeiro, avaliação de âncoras dentro do período e período exibido no popup. Manter Agenda monitorada, referências de 650 chamadas/R$25 dia e 13.000/R$500 mês, seis caps de extras em zero e nenhuma política automática habilitada. Preservar cache sem expiração por idade, flags e configuração financeira existentes. Não reativar/resetar orçamento nem copiar configuração de stage.

Promoção protegida stage → main com isolamento temporário no Git das entregas paralelas de Agenda, egress/WhatsApp e revisão clínica. O módulo agenda.py recebe somente os trechos da correção autorizada; a entrega Completar dia e os demais módulos exclusivos de stage ficam preservados para restauração no Git. A aplicação de stage já validada continua instalada enquanto essas operações de organização do Git têm seus deploys redundantes cancelados antes de qualquer etapa VPS. Preservar os seis arquivos de runtime, banco de frases e dados reais; nunca restaurar dados para ocultar atividade concorrente.

# Período explícito da busca — correção somente em stage, 23/10/2026

O pedido deste ciclo autoriza corrigir e validar em stage antes de apresentar o resultado; não autoriza produção. Para `agenda_offers` e `agenda_proximity`, uma preferência com `data_inicio`/`data_fim` substitui integralmente a janela aproximada, as datas de contato/referência e a expansão por política/progressão na estimativa. Quando não há intervalo explícito, mantém-se o envelope conservador da busca sem restrição. Validação de oferta continua usando a data local do horário escolhido.

A estimativa lê somente destinos/agendamentos dentro desse período, deduplica os trechos, prioriza a matriz Google/manual válida sem expiração por idade e conta apenas faltantes. Primeira saída, eventual Geocoding e alternativa após falha continuam explícitos e limitados. O popup mostra o período considerado, com datas civis sem conversão de fuso.

A execução respeita o mesmo alcance: a classificação de políticas não consulta novas rotas para âncoras D+0/D+2/D+3 fora da preferência solicitada. Não há oferta fora do intervalo, mudança das regras de conflito/primeira saída ou invenção de duração/disponibilidade. Rotas faltantes dentro do intervalo continuam exigindo consentimento finito e controle antes do Google; configuração/ledger indisponível suspende a parte paga, sem afetar consultas atendidas pelo cache.

Agenda monitorada com alertas preservada, referências atuais e bloqueios de novas chamadas pagas de lotes/automações inalterados. Sem migração, alteração de preços/câmbio, renovação de geocodificação ou reset de consumo. Rollback pelo snapshot anterior de aplicação; não restaurar banco/configuração para desfazer este código.

# Publicação autorizada da estimativa por busca — 23/10/2026

Após apresentação do stage `d497ffb2`, o usuário autorizou publicar a correção da estimativa de 4.096 e dos alertas. Preservar a política produtiva: Agenda monitorada com referências de 650 chamadas/R$25 por dia e 13.000/R$500 por mês, seis caps de extras em zero, nenhuma política automática habilitada e cache sem expiração por idade. Não reexecutar ativação nem copiar a configuração de stage.

A promoção contém os treze caminhos Maps de #451, a documentação desta autorização e quatro registros SDD históricos da otimização exclusiva de stage. As 27 diferenças paralelas de Agenda, egress/WhatsApp e revisão clínica são isoladas temporariamente no Git e restauradas integralmente em stage após a promoção. Os módulos da aplicação Maps permanecem byte a byte iguais ao stage homologado. Nenhum dado clínico de runtime será substituído por conteúdo do repositório.

# Especificação — autorização e orçamento Google Maps

## Estimativa por busca e alertas precisos — stage, 22/10/2026

Este incremento está autorizado apenas para stage; não publicar em produção antes de apresentar o resultado e obter nova autorização. Agenda permanece em `monitor`; não alterar referências financeiras, caps de extras, automações ou política de preços/câmbio.

A tentativa inicial continua usando exclusivamente rotas válidas em cache, sem exigir ledger nem consentimento pago. Se precisar de Google, o preview autenticado de busca de horários/proximidade/ofertas e validação de oferta calcula no servidor um grafo conservador dos trechos possíveis para destino, período, preferências e políticas da requisição. Reutiliza as mesmas funções de destino, agenda e validade da matriz. Direções válidas em cache contam zero; direções ausentes contam até dois transportes (Routes e uma alternativa Distance Matrix). Horários, perfis e dias não multiplicam trechos repetidos. A primeira saída, que ainda não possui cache durável de rota, é explicitada separadamente: até dois transportes e, somente se faltarem coordenadas da base, uma unidade Geocoding. Não presumir que um cache de clínicas também cobre a primeira saída.

A estimativa usa somente os SKUs possíveis pela configuração de tráfego do servidor e os preços/câmbio cadastrados, conservando incerteza e margem. O limite genérico administrativo (por exemplo, 4.096) continua sendo uma barreira superior, mas não é apresentado como previsão da busca. O máximo confirmado é o menor entre esse limite e o grafo calculado, e continua sendo verificado pelo ledger antes de cada transporte. Mudanças concorrentes que exijam rotas além do confirmado não autorizam chamadas extras. A falha em verificar o plano suspende a parte paga, sem inventar rota, duração ou disponibilidade. O plano não executa Google nem DML operacional e não expõe IDs, endereços ou coordenadas.

O texto “Referência diária/mensal atingida” exige consumo já igual ou superior ao valor/quantidade configurado. Com consumo abaixo e possibilidade de ultrapassar somente ao somar o máximo desta ação, informar “Esta ação pode ultrapassar a referência” e esclarecer que o consumo atual continua abaixo. Sem excesso nem revisão pendente, exibir informação neutra, sem aviso falso de teto atingido. Confirmar segue habilitado na Agenda monitorada; cancelar não envia Google. Cache completo não abre popup. Demonstração administrativa cobre cache, nova rota, possível excesso, referência já atingida e lote bloqueado, exclusivamente com dados fictícios e sem API.

## Publicação autorizada de 22/10/2026

O usuário autorizou publicar a reutilização da conexão na consulta de frases e a retirada da expiração por idade da matriz, mantendo a Agenda em `monitor`, referências de 650 chamadas/R$25 por dia e 13.000/R$500 por mês e bloqueio de lotes/automações para novos envios pagos. A promoção preserva a configuração financeira existente e os dados operacionais; não inclui os sete caminhos clínicos/SDD pendentes de stage. Código autorizado é o homologado em stage `0213c8f55711205ddbae9b5b46966fecb490683e`. As restrições de produção dos ciclos anteriores abaixo são históricas, substituídas somente para este escopo pela autorização atual.

## Matriz sem expiração automática por idade — decisão de 22/10/2026

O usuário aboliu o vencimento apenas por terem passado 30 dias. `GOOGLE_ROUTES_CACHE_EXPIRE_BY_AGE=false` é o padrão, aplicado igualmente aos consumidores da matriz, sem atualizar timestamps por simples leitura. `GOOGLE_ROUTES_CACHE_MAX_AGE_DAYS` permanece como parâmetro legado, usado somente se a expiração por idade for explicitamente reabilitada. O painel informa “Sem expiração por idade” e a API expõe `cache_expires_by_age=false`.

A ausência de vencimento por idade não converte heurística em rota confiável nem altera regras de agendamento. Continuam obrigatórios fonte Google reconhecida ou override manual autorizado, duração e timestamp verificáveis; nova geocodificação posterior ao cálculo invalida a rota. Cache ausente/incompleto e recálculo explícito continuam passando pelo controle no servidor antes de qualquer transporte, confirmação finita quando aplicável e bloqueio de extras/automáticos vigente. Leitura de rota antiga válida não depende de ledger nem gera consumo pago. Este incremento será validado somente em stage; produção exige autorização separada.

## Endereço do tutor usado no agendamento domiciliar

O botão de georreferenciar endereço dentro da Agenda utiliza `POST /agenda/geocode-endereco-tutor`, ação registrada `agenda_tutor_geocode`, limitada a uma unidade Geocoding por confirmação e vinculada ao endereço exato. Como parte do agendamento humano, essa consulta pode ultrapassar referências em `monitor`, após consentimento. O endpoint cadastral avulso continua sujeito ao teto rígido. Não usar flag arbitrária de payload para promover lote a ação da Agenda. Testar tentativa sem token/cancelamento sem transporte, confirmação de uma unidade, replay negado e preservação da regra do endpoint avulso.

## Canário independente do fuso PostgreSQL

Datas dos agendamentos sintéticos usam `LOCAL_TZ` explícito. A leitura de horário no teste converte o timestamp para Fortaleza antes da comparação; não remover o fuso de um timestamp UTC e compará-lo com relógio local. A validação instalada inicial de `f948dd60` concluiu o update HTTP 200 sem Google e depois acusou diferença na asserção de horário (14h30 UTC versus 11h30 Fortaleza). Isso é falha do fixture/comparação, sem evidência de falha do agendamento ou bloqueio de custo. Repetir a suíte integrada com conexão PostgreSQL em UTC e com o fuso Fortaleza. Não alterar fuso do banco de stage para contornar a prova.

## Política escolhida — Agenda com alertas, extras com teto (stage)

Esta seção atualiza os critérios financeiros anteriores para a escolha expressa do usuário em 19/10: **“Manter a Agenda liberada com alertas de custo; o teto rígido bloqueia apenas consultas em lote e tarefas extras.”** Nenhuma reativação em produção está autorizada neste ciclo.

- AM-001: configuração paga aceita `agenda_budget_mode=monitor|enforce`; legado permanece `enforce`. Somente ações HTTP humanas registradas `agenda_*` recebem `monitor`; IA, lotes, geocode, lookup avulso e ação `automatic` continuam sujeitos a todos os limites. `cache_only` rejeita a exceção `monitor`.
- AM-002: em `monitor`, valores financeiros por ação e totais de chamadas/custo por dia/mês são referências da Agenda e tetos rígidos dos extras. A cotação da Agenda não é reduzida/recusada por seu esgotamento. Uso da Agenda integra os totais compartilhados e pode esgotar o saldo dos extras.
- AM-003: cada ação da Agenda ainda exige confirmação com máximo finito de chamadas e custo (`max_calls × maior custo unitário conservador`). O máximo de chamadas por ação e eventual cap específico limitam a confirmação. Não existe confirmação permanente nem repetição ilimitada. O teto desta confirmação não corresponde ao valor financeiro de referência dos extras.
- AM-004: reservas continuam persistidas sob lock compartilhado antes do I/O. Ao ultrapassar referência, registrar `budget_alert` sanitizado uma vez por ação/período, sem duplicar chamadas/custo. Revalidar usuário, payload, revisão, validade, estado, SKUs e teto da confirmação a cada envio. Reiniciar processos não renova autorização.
- AM-005: popup e painel distinguem referência diária/mensal, saldo dos extras, alerta e teto desta confirmação. Exibir que **a Agenda pode gerar cobrança acima das referências e não possui teto financeiro diário/mensal neste modo**. Após confirmação, aviso amarelo não bloqueia a execução. Cancelar continua sem chamada paga.
- AM-006: ausência de política/preços/baseline/ledger/grant válido não é consentimento. Cache continua independente do ledger; uma nova rota exige controle verificável e resposta confiável. Não fabricar deslocamento/disponibilidade. Falha Google ou teto finito da execução ainda pode impedir um horário específico, com formulário mantido.
- AM-007: painel permite escolher a política sem preencher valores financeiros. Para nova configuração, apresenta a opção escolhida `monitor`; não converte config legada nem ativa por visita. Demonstração fictícia mostra cache, popup cancelar/confirmar e Agenda acima da referência, sem API/Google ou gravação.
- AM-008: stage operacional fica sem orçamento pago; canário executa configuração sintética somente em schemas descartáveis isolados. Produção continua em liberação emergencial sem alteração. Antes de ativar: conciliar consumo real, escolher valores, revisar preços/câmbio/validade e validar dimensionamento do máximo de chamadas por ação. Quota Google compartilhada baixa/zero também bloqueia Agenda; só aplicar segunda barreira compatível após decisão operacional, ou separar projetos/chaves/cotas dos extras. Nenhuma quota nativa foi alterada.

## Contrato vigente — Agenda com cache primeiro (rollout apenas stage)

- CF-001: `GOOGLE_MAPS_AGENDA_CACHE_FIRST=false` por padrão; quando habilitada, ações registradas `agenda_*` sem token recebem contexto local, sem acessar o ledger. Autenticação/permissões e validações de negócio permanecem exigidas. A liberação emergencial tem precedência.
- CF-002: preview inicial retorna `operation_mode=cache_first`, zero transportes nesta fase, sem quote/token/consentimento. Isso não declara que a ação inteira custará zero. Só o ponto real de envio Google pode solicitar uma estimativa paga (`paid_call_required=true`). Esse parâmetro não autoriza transporte.
- CF-003: cache Google válido e ajuste manual autorizado seguem sem popup, inclusive sem política, com limite esgotado ou indisponibilidade do ledger. Cache expirado/heurístico não fornece uma nova disponibilidade; falha de transporte/configuração não cria uma estimativa alternativa. Primeira saída mantém sua exigência de rota confiável.
- CF-004: no primeiro transporte necessário, o servidor consulta a política compartilhada. Sem grant pago, para antes do Google e retorna `confirmation_required`/`can_retry_with_confirmation=true`. Nenhuma criação/alteração de agendamento ou notificação é concluída nessa tentativa. As validações são repetidas sobre o estado atual após consentimento.
- CF-005: somente para essa resposta atestada da Agenda, o cliente obtém quote e mostra o popup; cancelar não envia Google nem conclui agendamento. Confirmar permite no máximo uma repetição com token de uso único e payload exato. Outras falhas, 422, erros de rede ou recusa após o grant não causam repetição automática.
- CF-006: se o preview inicial falhar ou exceder 3 segundos, o cliente pode tentar a Agenda sem token, mantendo a barreira no servidor. Se a estimativa paga falhar, o transporte continua suspenso. Lotes, IA e jobs não recebem essa exceção de tentativa HTTP; políticas automáticas e limites globais permanecem obrigatórios.
- CF-007: aviso na própria tela explica a consulta específica e mantém o formulário. Não afirmar que a agenda inteira está bloqueada. Rotas já válidas continuam disponíveis; uma rota desconhecida sem saldo não vira distância/duração/horário inventados.
- CF-008: painel mostra a estratégia e demonstra três casos (cache, nova consulta com cancelar/confirmar, limite atingido). Números da demonstração são fictícios; todos os botões da demonstração enviam zero APIs/Google e não criam agendamento/configuração.
- CF-009: produção permanece `temporary_open`, sem reativação de limites ou quotas nativas. A política para rotas novas acima da referência foi escolhida e está descrita em AM-001–008; os valores reais precisam ser revisados antes da ativação. Não há neste incremento um cadastro persistente novo de pré-agendamentos; formulário preservado não é solicitação salva nem horário confirmado.

As seções seguintes preservam o histórico dos ciclos anteriores. Declarações de ativação/custo zero nelas não substituem o estado vigente acima.

## Liberação emergencial solicitada em 19/10/2026

O usuário informou que a recepção não consegue agendar e autorizou: “Deixe liberado por enquanto”. Esta instrução suspende a ativação do modo R$ 0 e autoriza temporariamente as consultas potencialmente cobradas. A observação instalada mostrou `reason=unconfigured`, revisão 0 e nenhuma política aprovada; o bloqueio ocorria antes de qualquer consulta Google. Não houve ativação de quota nativa zero.

`GOOGLE_MAPS_COST_EMERGENCY_RELEASE=true`, exclusivamente no servidor, libera temporariamente preview/execução/provedores, inclusive tarefas automáticas. Default `false`. Não altera autenticação, permissões funcionais, regras de deslocamento, cache ou registros de agenda. Nenhum preço, baseline, saldo gratuito ou teto financeiro é inventado. Preview retorna `required=false`, `operation_mode=temporary_open` e máximos de chamadas/custo `null`. O painel administrativo mostra a suspensão e oculta controles que não surtiriam efeito durante a exceção.

Cada tentativa de provedor registra aviso sem chave/endereço/payload, com SKU e custo desconhecido. O ledger anterior fica preservado; não representa nem contabiliza o gasto desta exceção como R$ 0. A conciliação desse intervalo é obrigatória antes de voltar a orçamento pago. A exceção não depende de ler o ledger: indisponibilidade dele não deve reproduzir a interrupção operacional autorizadamente removida. A autenticação e o banco de negócio continuam necessários.

Encerrar a liberação requer retirar a flag (ou `false`) e reiniciar API e worker. A decisão é relida em cada chamada; um contexto temporário não mantém autorização após a flag desligada. Sem configuração aprovada, isso volta a bloquear agendamentos dependentes de Maps. Portanto, não reativar os controles sem resolver e validar antes a política operacional escolhida. Não há prazo ou teto financeiro presumido.


## Modos e decisão de produção

`operation_mode` distingue `paid_budget` (padrão para configurações legadas) de `cache_only`. A publicação autorizada em 18/10/2026 utiliza **somente `cache_only`**, com zero novos envios Google. Os requisitos de reserva, confirmação e baseline abaixo continuam vigentes quando `paid_budget` é explicitamente autorizado. Nenhum dos modos libera gasto com base apenas no relatório atrasado de franquia.

## Contrato

- RF-001: todo envio Google exige reserva persistida antes do I/O, inclusive fallbacks, chamadas diretas e workers. Cache já persistido não consome uma nova chamada.
- RF-002: configuração inicial não contém orçamento aprovado. Sem configuração válida ou acesso ao controle compartilhado, o envio Google é suspenso. Em `paid_budget`, também são exigidos consentimento e saldo. Nenhuma flag permite ignorar a proteção.
- RF-003: limites de chamadas e custo estimado em BRL por ação, dia e mês; cada tentativa enviada consome reserva conservadora inclusive timeout/erro, pois não é possível provar ausência de cobrança. Não estornar automaticamente tentativas incertas.
- RF-004: preview autenticado não consulta Google; em `paid_budget`, identifica ação/serviço, teto verificável de chamadas, faixa de custo, incerteza, consumo, limites e saldo. Esse teto limita a execução; não promete completar uma busca que precise de mais chamadas.
- RF-005: confirmação explícita gera autorização curta, vinculada ao usuário e hash da requisição exata (método, caminho, parâmetros e corpo). Uma autorização permite uma única execução, com quantidade e valor finitos. Repetição, alteração de payload, expiração e concorrência não renovam o teto.
- RF-006: o servidor revalida saldo global a cada reserva. Confirmação não aumenta teto diário/mensal, mesmo quando foi obtida antes de outra ação consumir saldo.
- RF-007: automações que enviam Google em `paid_budget` precisam de política nominada, desabilitada inicialmente, com orçamento próprio dentro do global e identidade estável da execução. Repetir o mesmo job não cria autorização nova ilimitada. Em `cache_only`, tarefas podem usar dados permitidos em cache, mas nenhuma política automática autoriza transporte Google.
- RF-008: em `paid_budget`, UI exibe “Cancelar” e “Confirmar esta ação” antes de executar ação com possibilidade de custo. Cancelar/fechar/abortar não dispara a operação. Sem “não perguntar novamente”. Em `cache_only`, a ausência de popup significa teto de zero envios, não consentimento permanente. Erros ficam visíveis na tela atual, acima de modais.
- RF-009: administração restrita mostra configuração, consumo estimado e histórico de bloqueios sanitizado. Configuração não é equivalente a cobrança conciliada Google.
- RF-010: bloqueio de custo não se transforma em distância zero, heurística ou oferta fictícia. A mensagem informa o impedimento; regras existentes de agenda permanecem autoritativas.
- RF-011: revalidação Google bem-sucedida renova o timestamp do cache mesmo com valores iguais. Ajustes manuais protegidos continuam preservados.
- RF-012: a primeira habilitação de `paid_budget` exige baseline explícito de chamadas/custo do dia e mês, data atual em Fortaleza e base da apuração. O baseline é somado uma vez e não pode ser reduzido por editar configuração; a base sintética é recusada em produção. `cache_only` não cria baseline zero nem apaga baseline/eventos anteriores.
- RF-013: em `paid_budget`, o catálogo público de 18/10/2026 impede preços unitários abaixo de USD 0,005 para Essentials/Geocoding e USD 0,01 para Pro/Advanced. Preços de contratos descontados não são usados para liberar saldo conservador. Câmbio superior e validade são escolhas explícitas da administração; não preencher esses valores artificialmente em `cache_only`.
- RF-014: o cache consultado durante validação de escrita da agenda faz flush sem commit; somente o endpoint pode confirmar agendamento e cache depois de completar todas as validações. Bloqueio intermediário reverte a escrita operacional, preservando as reservas financeiras já consumidas.
- RF-015: configuração `cache_only` usa `enabled=true` para habilitar o modo local e limites `calls=0`, `estimated_brl=0` em ação/dia/mês. `enabled` nesse modo nunca habilita rede Google. Preços, câmbio, validade de preço e campos de baseline ficam ausentes do payload administrativo; histórico já registrado permanece preservado no servidor.
- RF-016: preview `cache_only` retorna `required=false`, `blocked=false`, `operation_mode=cache_only`, teto de zero chamadas e zero custo, sem quote/token de autorização paga. A execução mantém contexto durável limitado a zero; o backend reavalia o modo e o limite antes de qualquer transporte.
- RF-017: somente rota Google persistida válida ou override manual persistido/autorizado atende deslocamento em `cache_only`. Exige duração, timestamp válido e geocode compatível, sem expiração automática por idade no padrão vigente. Se a política de idade for explicitamente reabilitada, TTL positivo passa a ser obrigatório nesse modo. Ajuste manual exige `manual_override=true`, não apenas `fonte=manual`. Cache ausente, invalidado ou heurístico gera bloqueio com motivo visível; não atualizar timestamps por leitura, fabricar rota ou aceitar heurística para contornar o modo.
- RF-018: Routes, Distance Matrix legado e Geocoding recusam toda tentativa em `cache_only`, inclusive `force_refresh`, fallback, jobs, acesso direto e lookup com API key ausente ou flag legada desligada. A checagem não pode depender apenas do middleware/frontend.
- RF-019: uma execução iniciada em `cache_only` permanece limitada a zero mesmo se a configuração mudar para `paid_budget` durante a ação. Grants anteriores e políticas automáticas não superam o modo atual ou o limite original; uma mudança de modo exige o fluxo próprio da nova ação.
- RF-020: o painel mostra o modo, zero novos envios/custo, histórico preservado e motivo do bloqueio. Selecionar `paid_budget` posteriormente exige orçamento/preços/baseline válidos e confirmação por ação; não converter ausência de dados financeiros em zero histórico ou franquia disponível.
- RF-021: a publicação deste incremento em produção exclui os 13 caminhos clínicos restaurados por PR #391. Os dados existentes, arquivos de runtime e as regras de agendamento permanecem protegidos; o resultado instalado e a configuração efetiva precisam de evidência posterior.

- RF-022: cache de primeira saída mantido somente em sessão, sem timestamp/TTL verificável, não é evidência de rota válida em `cache_only` e deve ser recusado. Não produzir nova estimativa para liberar primeira saída.
- RF-023: trocar `paid_budget` por `cache_only` impede novas reservas e novos fallbacks, mas não cancela retroativamente uma reserva paga que já ultrapassou a checagem e pode estar em trânsito. A ativação inicial exige deploy/reinício confirmado dos processos antigos, estado sem orçamento habilitado antes da configuração zero e comprovação separada da segunda barreira Google; não prometer reversão de chamadas já enviadas.

## Modelo financeiro e limites

Em `cache_only`, nenhum SKU é enviado e não há cálculo de preço/câmbio para autorizar rede. Zero refere-se a novos envios governados pelo modo instalado e verificado deste backend, sem anular uso passado, faturas em processamento, chamadas previamente autorizadas em trânsito ou consumo de outros clientes da mesma chave. A mudança de configuração sozinha não atesta que processos antigos foram reiniciados.

Em `paid_budget`, SKU é determinado pelo provedor e pelo modo de tráfego efetivamente enviados. Geocoding e Distance Matrix também são controlados, embora o Billing fornecido destaque Routes Essentials. A estimativa conservadora reserva a tarifa superior configurada por evento multiplicada por um câmbio superior explícito. Não presume franquia livre do projeto, porque franquias/faixas podem ser compartilhadas pela conta de faturamento. A faixa exibida pode começar em zero; o bloqueio usa o extremo superior.

A cobrança efetiva depende de SKU, consumo dos demais projetos, contrato/faixas, créditos, câmbio/impostos e processamento tardio do Billing. O ledger é evidência de reservas/tentativas controladas pela aplicação, não uma reprodução da fatura. O histórico anterior à ativação paga precisa ser conciliado; não se pode chamar o contador novo de consumo integral do mês da conta Google.

Quotas nativas são segunda barreira por projeto/API e métrica que o console realmente permita editar. Quota por minuto limita velocidade, não garante teto mensal. Alertas de budget não interrompem serviço. No console autenticado de 18/10, quotas diárias Routes Compute Routes e Compute Route Matrix estavam ilimitadas, com uso atual exibido zero e limite por minuto de 3.000; nenhuma alteração foi comprovada até esse registro. Compute Route Matrix não é o fallback Distance Matrix legado do código. O reset mensal da franquia Google ocorre no primeiro dia às 00:00 do Pacífico dos EUA, distinto do contador operacional em Fortaleza. Registrar quotas efetivas separadamente; não chamar observação de quota de bloqueio aplicado.

## Persistência e segurança

Migração aditiva para política, autorizações, contadores e eventos. Serialização compartilhada em transação independente impede que rollback da agenda apague gasto já autorizado. Não guardar corpo/endereço/chave no ledger; somente hashes e identificadores operacionais necessários. Erros de transporte geocoding são sanitizados para não divulgar URL/chave/endereço.

Rotas administrativas são autenticadas e restritas a administrador. A autenticação normal da ação continua exigida. Um token financeiro não concede permissão funcional.

## Aceitação

CA-001: cancelar em `paid_budget` → zero execução da ação e zero envio pago. CA-002: concorrência em conexões/processos distintos nunca supera chamadas/BRL. CA-003: pedido direto sem grant e worker sem política não enviam Google em `paid_budget`; em `cache_only`, nenhuma dessas origens envia Google. CA-004: replay e payload alterado recusados no fluxo pago. CA-005: limites persistem após recriar sessão/processo. CA-006: falha de banco fecha o transporte. CA-007: TTL estável é renovado somente por revalidação Google autorizada; segunda sessão reutiliza rota. CA-008: UI/servidor mantêm privacidade e não produzem disponibilidade por fallback financeiro. CA-009: validar o novo modo em stage e produção autorizada, usando dados sintéticos e preservando registros reais; publicação ainda precisa de prova instalada. CA-010: no canário remoto, indisponibilidade de conexão é uma rejeição de segurança registrada separadamente; nunca transforma a tentativa em envio nem justifica afrouxar limites.

CA-011: configuração `cache_only` aceita payload sem preços/FX/baseline e não cria consumo anterior fictício. CA-012: rota persistida válida/manual é usada sem popup de custo, quote, confirmação paga ou transporte; miss/expirado/heurística interrompem a ação com motivo claro. CA-013: zero transportes sob acesso direto, job, chamadas simultâneas e mudança concorrente de modo. CA-014: regressões de `paid_budget` continuam aprovadas e seu primeiro uso conserva exigência de baseline/preços. CA-015: UI distingue orçamento zero de fatura histórica zero e não apresenta o relatório de outubro como saldo gratuito confirmado.

CA-016: quando a política de expiração por idade está explicitamente habilitada, TTL não positivo é recusado em `cache_only`. Fonte manual sem override e cache de sessão da primeira saída sem evidência verificável continuam recusados em qualquer política. CA-017: a promoção documenta o reinício dos processos no snapshot aprovado e separa a recusa de novas reservas de chamadas anteriormente autorizadas em trânsito.
# Revisão de limites em 21/10/2026

Preparação/demonstração autorizadas em stage, sem reativação em produção. A demonstração exibe proposta de referências 650/R$25 por dia e 13.000/R$500 por mês, sem salvá-la, com valores conservadores brutos distintos da fatura após franquia. Mostra Agenda acima da referência e lote suspenso; não chama APIs nem altera dados. Rascunho tipado `proposed-monitor-config.json` permanece desabilitado, com lotes/IA/automação sem autorização de novas consultas. Endereços fictícios/incompletos de stage não validam rotas reais nem são enviados ao Google para testes. Procedimento, fonte histórica e condições em `preparation-20261021.md`.

A futura transição de produção deve drenar os emissores antigos antes de fechar o baseline e iniciar a política nova. Configurar o orçamento enquanto a emergência continua ativa não contabiliza essa janela. Sem baseline superior confiável, todas as ações não Agenda ficam com teto zero, preservando a política humana explicitamente escolhida. Procedimento em `activation-cutover.md`.

O componente público compilado da demonstração não incorpora pagamentos ou volumes históricos reais. Esses dados permanecem no relatório de auditoria; a tela mostra apenas referências propostas, cenários hipotéticos e consumo fictício.

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
