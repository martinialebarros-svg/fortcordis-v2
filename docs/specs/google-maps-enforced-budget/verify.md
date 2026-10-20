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
