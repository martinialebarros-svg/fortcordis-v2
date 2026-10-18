# Auditoria Google Maps / Fort Cordis — 18/10/2026

Este relatório descreve o estado **anterior à implementação**. Fontes de código: `origin/stage` `74f0148c3bbd7a3365753d15fe2e85fbc72d2282` e `origin/main` `9137d39fea18c795bb1cb7b1cc9bc204dce05d69`; ambos confirmados instalados nos respectivos ambientes por SSH. Nenhuma chamada Google foi executada. Não houve escrita remota, alteração de quotas, envio de mensagem ou acesso a dados clínicos. Consultas SQL foram executadas com `SET TRANSACTION READ ONLY` e `statement_timeout=12s`.

Evidência agregada reproduzível: `evidence/audit-20261018.sanitized.json`. Coletor SQL reproduzível: `scripts/google_maps_readonly_audit.py`. Os agregados do journal foram apurados separadamente por comandos SSH readonly, normalizando os caminhos antes de salvar; o coletor SQL não reconstrói logs que já foram rotacionados. O JSON contém contagens, datas, fontes e configurações não secretas; não contém nomes, endereços, chaves, credenciais ou IDs de entidades. Evidência Billing original fornecida pelo usuário foi lida localmente, sem copiar dados da conta para o repositório.

## 1. Conclusão e limites da atribuição

**Observado:** o banco de produção corrobora o crescimento de chamadas em julho/agosto. Também há defeito reproduzido na renovação do cache: quando uma atualização Google retorna exatamente os mesmos valores, o timestamp permanece antigo, e a próxima consulta considera a rota expirada novamente. Esse defeito está no histórico desde março; não surgiu em agosto.

**Observado:** as repetições do mesmo par aumentaram fortemente em agosto, com quase todas as chamadas registradas bem-sucedidas. O padrão não sustenta uma tempestade de tentativas após falha como principal explicação dos registros conhecidos.

**Hipótese fortemente sustentada, ainda não atribuição integral:** o cache expirado sem renovação contribuiu para desperdício e para o aumento. Faltam `action_id`, endpoint, motivo de refresh e versão de configuração em cada evento histórico para quantificar quanto do aumento foi causado por isso, por recálculo forçado, pelo uso normal, pela IA, ou por simultaneidade. Não é correto atribuir as 9.744 chamadas adicionais exclusivamente a esse defeito.

| Medida | Julho/2026 | Agosto/2026 |
|---|---:|---:|
| Billing: Routes Essentials | 13.062 | 22.806 |
| Billing: valor BRL | 90,12 | 372,45 |
| Produção: `compute_routes` | 12.915 | 22.709 |
| Produção: status OK | 12.915 | 22.708 |
| Produção: erro Routes / fallback Distance Matrix | 0 / 0 | 1 / 1 vazio |
| Stage: Routes OK | 2 | 2 |
| Pares direcionados distintos em produção | 3.097 | 3.992 |
| Chamadas além da primeira por mesmo par/hora | 7.757 | 15.103 |
| Máximo de chamadas por par/hora | 33 | 45 |
| Chamadas OK em que o timestamp atual da matriz já era >30 dias anterior à chamada | 3.541 | 12.311 |
| Eventos `ASSISTENTE_AGENDA_OFERTA_GERADA` | 725 | 794 |
| Eventos `AGENDAMENTO_CRIADO` | 250 | 252 |

As datas das métricas são as gravadas no PostgreSQL; não foi demonstrada equivalência exata do fuso/agregação com Billing. A diferença produção↔Billing (147 em julho, 97 em agosto) não é atribuída automaticamente ao stage, cuja tabela mostra somente duas chamadas por mês. Não foi inventariada a utilização de todas as chaves/projetos da conta de faturamento. Falhas antes da persistência, outros ambientes, fuso e chamadas não instrumentadas são possibilidades ainda não conciliadas. O timestamp atual não reconstitui toda a evolução histórica da linha; o join comprova ausência de timestamp posterior na linha atual, não o endpoint que chamou.

Produção mantém 60.545 métricas desde 11/04 até 17/10/2026. `GOOGLE_MAPS_USAGE_METRICS_RETENTION_DAYS=90` está configurado, mas dados anteriores permanecem; a opção não prova execução de limpeza. Configuração atual em produção e stage: cache 30 dias; lookup ao vivo em leitura ligado; refresh forçado de heurística desligado; tráfego desligado. Esses valores atuais não provam quais estavam ativos em julho/agosto.

**Logs disponíveis:** journal da unidade `fortcordis-backend` conserva registros de09/08/2026 12:48UTC até31/08/2026 23:59UTC na janela pedida; julho não está retido nesse recorte. Foram agregados151.201 registros, dos quais140.454 requisiçõesHTTP. Caminhos capazes de gerar custo mais frequentes no recorte: proximidade810 respostas200 +13 respostas500, ofertas582 respostas200 +43 respostas500, sugestões do dia71 respostas200; IA chat7 respostas200, consulta de par Logística4 respostas200. Não há POST `/logistica/recalcular` no journal disponível, portanto recálculo completo é o maior risco teórico por ação, mas não há evidência dele como origem do volume nessa parte de agosto. Falhas500 das ações não equivalem a falhaGoogle, e ausência de correlation ID impede repartir chamadas Google pelos endpoints com exatidão. A extração retornou apenas método, rota sem parâmetros/IDs, status e contagem.

## 2. Caminhos reais e multiplicidade

As três saídas Google encontradas em código são `logistica_service.py:614` (POST Routes), `logistica_service.py:732` (GET Distance Matrix legado), e `geocoding_service.py:120` (GET Geocoding). Não há Google Maps JS/SDK custoso no frontend encontrado por busca de host/API. Links externos de navegação não são esses três transportes.

| Ação/caminho | Fonte no snapshot stage | Chamadas possíveis antes do controle novo |
|---|---|---|
| Consultar/recalcular par na Logística | frontend `app/logistica/page.tsx:268`; backend GET `/logistica/deslocamento`, `endpoints/logistica.py:91`; serviço `obter_ou_criar_deslocamento:1241` | Cache válido: zero. Miss/force: até 1 Routes + 1 Distance Matrix se Routes falhar/retornar vazio. GET pode custar. |
| Recalcular matriz completa | frontend `app/logistica/page.tsx:342`; POST `/logistica/recalcular`, endpoint:122; serviço:1159–1238 | Até `N×(N−1)` Routes, mais igual número de fallbacks. Dois perfis reutilizam resultado Google dentro da chamada. Em 178 clínicas ativas observadas hoje: 31.506 Routes, até 63.012 transportes somando fallback. |
| Recalcular uma clínica | mesmo POST; serviço:1071–1156 | Até `2×(N−1)` Routes, mais fallbacks. Para N=178: 354 Routes, até 708 transportes. |
| Gerar ofertas e panorama de agenda | `NovoAgendamentoModal.tsx:2628`; POST `/agenda/assistente/ofertas`, `agenda.py:5604`; chama proximidade e `sugerir_horarios_agenda:5715` | Vários pares por vários dias. Cache por par/perfil dentro de uma busca reduz chamadas, mas número de opções exibidas não limita chamadas; busca progressiva pode avançar 30 dias. Cada par frio tem até 2 transportes. |
| Sugestões de um dia e proximidade | frontend:2384/1931; POST `/agenda/sugestoes-horario` e `/agenda/sugestao-proximidade`; `agenda.py:4526`, `5086` | Avaliam pares de destinos anteriores/seguintes e rota direta; cache interno reduz repetições por slot. Para K destinos/âncoras distintos, ordem de grandeza até 2K pares destino↔âncora, acrescidos pares diretos e primeira saída. Limite de 8/50 sugestões não é teto Google. |
| Revalidar, criar, editar, status, reabilitar | `/agenda/assistente/validar-oferta` (5009); agenda criar6198, editar6400, status6751, reabilitar7225; `_validar_deslocamento_agendamento:2130` | Revalidação é outra requisição. Até par anterior→destino, destino→próximo e eventual anterior→próximo, mais primeira saída; cada cache frio até 2 transportes. |
| Primeiro trajeto base→destino | `agenda.py:1050–1170`, utilizado nas ofertas e validações | Cache só na sessão `db.info`: nova requisição pode pagar outra Routes, mais fallback. Se base não possui coordenadas, até 1 Geocoding extra por endereço/processo frio (`lru_cache`), não compartilhado/restart-safe. Rota não passa `telemetry_events`, logo faltava nas métricas existentes. |
| IA administrativa: horários | `assistente_ia_tools.py:832–872` chama `agenda.sugerir_horarios_agenda` diretamente | Percorre dias (padrão 7, clamp normal14; preferência explícita define intervalo). Mesmo custo de busca diária. Não passa pela UI da Agenda. |
| IA administrativa: rota entre clínicas | `assistente_ia_tools.py:977` | Mesmo miss de consultar par. Flag lookup ao vivo em leitura não era aplicada por `obter_ou_criar_deslocamento`. |
| WhatsApp: oferta e revalidação | `whatsapp_bot_opcoes_agenda.py:91–101`, `127–148`, `203–213` | Worker chama função agenda diretamente, até14 dias até obter3 opções; escolha revalida. Sem contexto HTTP/popup. Deve ter política e teto próprios; código introduzido em setembro, não explica agosto. |
| Geocodificar clínica/tutor | `clinicas.py:344`, `tutores.py:491`; UI clínica novo:187/241 e editar:209/263; Agenda modal1761 | 1 Geocoding por consulta. Clínica aciona também onBlur, não apenas botão. Geocoding não alimentava a tabela de métricas de Routes. Billing:73 chamadas julho/43 agosto, custo zero. |

`GET /logistica/matriz`, cobertura/resumo/custos e listagem de agenda só leem dados; não foram classificados como geradores Google por nome de tela. Não foi encontrado job dedicado a recálculo automático da matriz por busca de referências dos chamadores. Os caminhos automáticos observados são os consumidores de Agenda via IA/WhatsApp.

## 3. Desperdícios e falhas de controle observadas

1. **TTL não renovado:** `logistica_service.py:1006–1017` altera `updated_at` somente se km/min/fonte mudam, enquanto `:443–448,555–559` usa esse timestamp para validade. Repro com resultado sintético idêntico, linha de31 dias/TTL30: antes=false, depois=false, timestamp preservado, `changed=false`. Zero rede/banco. Deve renovar a confirmação bem-sucedida Google, preservando override manual e sem promover fallback heurístico a dado Google.
2. **Sem teto financeiro/contador atômico prévio:** os endpoints existentes informam recomendações de quotas e estimativas depois das consultas; não reservam cota global, ação/dia/mês nem exigem autorização individual. A flag de leitura cobre alguns chamadores, não todos.
3. **Corrida em cache frio:** leitura SELECT e chamada Google acontecem antes do upsert/commit; sem deduplicação/lock compartilhado de lookup. Requisições concorrentes podem pagar o mesmo par. 1.613/2.818 eventos em julho/agosto têm intervalo<1s para o mesmo par; esse tempo sozinho não prova simultaneidade.
4. **Fallback cobrável:** falha/vazio de Routes dispara Distance Matrix automaticamente em `:899–905`; não há loop de retry HTTP explícito nos transportes. Retentar ação/UI é nova chamada. Histórico conhecido tem apenas1 erro/fallback em agosto; não atribuir aumento a retries.
5. **Primeira saída sem cache persistente/telemetria:** risco atual, introduzido outubro. Não pode ser causa de julho/agosto.
6. **Popup inexistente:** editar agenda dispara proximidade via effect (`NovoAgendamentoModal:2204–2253`); alterações sucessivas podem iniciar consultas, e sequência de resposta descarta resposta obsoleta sem desfazer custo já enviado. Geocode onBlur também custa sem confirmação.
7. **Telemetria insuficiente para auditoria causal:** a tabela só possui serviço/operação/provider/status/par/perfil/data. Faltam ação, requisição, usuário responsável/política, tentativa, motivo cache/force, confirmação e reserva de limite. Eventos são persistidos ao final; rollback/processo interrompido pode perder contabilização após Google ter recebido a chamada. Primeira saída e geocoding têm buracos instrumentais.
8. **Estimativa antiga não é limite nem fatura:** `_resumir_custo_google_maps:205–332` aplica franquia inteira a janela móvel de dias, projeta30 dias, ignora outros projetos/ambientes da mesma conta, usa USD sem câmbio BRL. Pode subestimar gasto e não fornece saldo confiável por mês civil. Nome de cenário “conservador” conta só OK, portanto não é teto financeiro conservador.
9. **Privacidade de erros:** `geocoding_service.py:121–122` interpola exceção externa na resposta; URLs contêm chave/endereço. Sanitizar mensagem antes de devolução/log. Nos demais registros novos, proibir chave/endereço/query bruta e manter IDs de ação/causa seguros.

## 4. Histórico relevante, sem confundir cronologia e causalidade

- `0f80b52d` (08/03): introduziu upsert condicionado à mudança; `git blame` comprova origem das linhas1006–1017.
- `f08ed04d` (11/04): cache/telemetria e racionalização Google.
- `bea8ca2f` (21/04): cache por requisição e gate de heurística.
- `64eb8181` (31/05): relatórios de custo/quotas e lookup vivo defaultTrue.
- `f73df114`/`fce0147e` (08/07): atendimento domiciliar/assistente; `718fa303` (09/07) persiste matriz domiciliar e reutiliza perfis.
- `61906616` (20/07) e evolução21–23/07: IA administrativa acrescenta chamadores de agenda/rota. Crescimento de métricas diárias perto dessas datas é correlação, sem ação individual não prova causa.
- Não há commit de `logistica_service.py` em agosto. Houve mudanças da agenda, reservas e portal, mas sem trace não é correto escolher uma como causa.
- `31e1bb30` (10/09): WhatsApp oferece horários/revalida; outubro: primeira saída. São riscos atuais a proteger, não explicações cronologicamente válidas para agosto.

## 5. Google: SKU, preço, franquia, câmbio e quotas

Tabela oficial consultada em18/10/2026: Routes Compute Routes Essentials (`9EFF-679A-9B16`) tem franquia de10.000 eventos/mês; preço marginal USD5/1.000 até100.000, depois4,3,1,50,0,38 nos patamares seguintes. Tráfego `TRAFFIC_AWARE`/`TRAFFIC_AWARE_OPTIMAL` muda para Pro, franquia5.000/preço inicialUSD10/1.000. Distância legada cobra por elemento; neste código1origem×1destino=1elemento. Geocoding tem SKU/franquia próprios. Uso e faixas agregam os projetos da conta de faturamento: não conceder10.000 livres separadamente a prod e stage nem assumir saldo livre sem evidência de toda a conta. [Pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [Billing overview](https://developers.google.com/maps/billing-and-pricing/billing-overview).

Controle conservador recomendado: cada saída reserva o preço marginal mais alto aplicável ao SKU, sem descontar franquia compartilhada não verificada; desconto/faixa só se a informação global for confiável. Preço de tabelaUSD e conversãoBRL devem ter versão, data, margem e validade. Se câmbio confiável expira ou reserva não pode ser verificada, bloquear geração de custo. Não deduzir câmbio oficial dividindo fatura por chamadas sem conciliar franquias/tributos/ajustes. O export Billing contém `currency_conversion_rate` e preços efetivos; câmbio Google não é necessariamente cotação comercial do instante. [Moedas](https://docs.cloud.google.com/billing/docs/resources/currency), [Export de preços](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/pricing-data).

Dados Billing normalmente aparecem em até um dia, mas podem demorar mais de24h e uso tardio pode entrar na fatura seguinte. Portanto faturamento não serve como semáforo em tempo real. Julho/agosto acima se referem a uso, não ao mês do pagamento. [Relatórios Billing](https://docs.cloud.google.com/billing/docs/how-to/reports).

A documentação Routes instrui limites diários em Google Maps Platform → Quotas, e informa3.000QPM para Compute Routes. Reduzir quota diária e por minuto funciona como segunda barreira independente do servidor; conferir o valor efetivamente disponível para cada serviço/projeto, unidade, escopo e fuso de reset, incluindo Geocoding e fallback legado. Quotas e Billing são sistemas distintos e podem divergir: margem abaixo do teto monetário é necessária. Orçamento/alerta sozinho não bloqueia. Não foi lida nem alterada a configuração autenticada de quotas do projeto neste trabalho; a etapa de aplicação precisa do teto escolhido e autorização de produção. [Routes usage](https://developers.google.com/maps/documentation/routes/usage-and-billing), [Manage costs](https://developers.google.com/maps/billing-and-pricing/manage-costs).

## 6. Entrega e coleta segura restante

Não foi escolhido teto financeiro do usuário. A implementação deve oferecer modo bloqueado antes da ativação e limites por ação/dia/mês em número de saídas e estimativa conservadora, com confirmação restrita ao método/rota/payload/usuário/expiração, consumo atômico e idempotência. A política automática deve ser explícita, desabilitada inicialmente, com limite próprio subordinado ao global. Falha de banco/configuração não autoriza saída.

Para explicar com precisão o residual histórico: export agregado Google por dia/SKU/projeto/chave (identificador pseudônimo), tabela de preço/câmbio da conta, configuração de quotas e escopo da franquia. Para atribuição futura: registrar tentativa antes do transporte, ação/endpoints normalizados, `request_id`, cache hit/miss/refresh/force, bloqueios, SKU/preço vigente e ambiente; não registrar endereços/URLs/chaves. Medir de novo após correçãoTTL mantendo volumes de ações como denominador, sem prometer economia a partir apenas de testes.
