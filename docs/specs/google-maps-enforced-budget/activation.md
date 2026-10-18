# Ativação e escolha de limites

## Estado de entrega

A migração cria somente tabelas. Não aprova orçamento, não habilita chamadas e não configura quota Google. A publicação em produção depende de autorização separada. Stage fica sem chamadas pagas habilitadas; o canário executa sucessos apenas em schema sintético com transporte Google simulado.

## Escolha do proprietário

Estas são **opções para decisão, não configurações aplicadas**. O teto financeiro e o teto de chamadas atuam juntos; atingir qualquer um interrompe novas consultas. Como a estimativa reserva chamadas sem presumir franquia, o bloqueio financeiro pode ocorrer antes do teto numérico.

| Perfil proposto | Limite estimado por ação / dia / mês | Chamadas por ação / dia / mês | Consequência operacional |
|---|---|---|---|
| Contenção | R$ 1 / R$ 5 / R$ 100 | 20 / 300 / 10.000 | Menor reserva financeira; pode suspender buscas extensas e atingir o teto monetário com bem menos de 10.000 chamadas. |
| Intermediário | R$ 2 / R$ 10 / R$ 200 | 40 / 500 / 15.000 | Reserva financeira intermediária; o teto de 15.000 chamadas não significa que esse volume caberá em R$ 200. |
| Continuidade com limite | R$ 3 / R$ 15 / R$ 350 | 80 / 900 / 25.000 | Maior reserva entre as opções; a estimativa conservadora pode bloquear antes de 25.000 chamadas. |

As opções não prometem concluir uma matriz completa. Com 178 clínicas, uma matriz fria pode precisar de 31.506 Routes, mais fallbacks; deve ser planejada como operação excepcional com teto específico, nunca autorizada indefinidamente. O teto de uma ação também pode impedir uma busca longa antes de terminar. Depois de corrigir o TTL, medir consumo real por ação antes de aumentar os valores.

Exemplo somente didático, sem aplicar câmbio ou margem: com USD 0,005 por Routes Essentials, câmbio superior de R$ 6/USD e multiplicador 1,20, cada tentativa reserva R$ 0,036. Os tetos de R$ 100 / R$ 200 / R$ 350 comportariam, no máximo, 2.777 / 5.555 / 9.722 dessas tentativas, antes de limites diários, outras chamadas ou consumo inicial. A franquia não é abatida dessa reserva; portanto não comparar esses tetos diretamente à fatura histórica para prever capacidade.

Os números acima não são previsão de fatura nem escolha do usuário. Podem ser substituídos livremente por outros valores aprovados. O orçamento automático do WhatsApp precisa ser escolhido separadamente, dentro do global; permanece desligado até isso ocorrer.

## Procedimento de ativação

1. Confirmar ambiente/projeto/chave de destino e o snapshot validado. Não copiar chaves entre stage e produção. Aplicar migração aditiva por deploy normal.
2. Em **Configurações → Custos Google Maps**, preencher limites por ação/dia/mês explicitamente. O formulário não preenche um teto automaticamente.
3. Preencher preços USD por unidade de cada SKU, câmbio BRL/USD superior, multiplicador conservador e validade. Referência pública em 18/10/2026: Essentials/Geocoding USD 0,005 por unidade; Pro/Distance Matrix Advanced USD 0,01 por unidade. Revisar contrato e tabela oficial; a reserva não desconta franquia nem descontos de volume.
4. Declarar consumo anterior do **dia e mês** antes da primeira habilitação, com data em Fortaleza e base da apuração. Pode usar telemetria conciliada ou limite superior conservador; zero exige evidência explícita. Dados Billing têm atraso. Se o consumo não puder ser limitado com segurança, manter suspenso. O baseline é adicionado uma vez, não pode ser diminuído em revisões e não é reintroduzido a cada mês. O ledger controla os envios posteriores.
5. Conferir **todos os projetos/chaves da mesma conta**: franquia/faixas são compartilhadas. O controle local não limita consumo de outra aplicação ou chave fora deste backend. A medição começa na implantação e recebe o baseline informado; não reconstrói automaticamente toda a conta Google.
6. Definir quotas nativas como segunda barreira: Google Maps Platform → projeto `fortcordis-maps` → Routes API → Quotas. Conferir métricas editáveis, escopo/unidade, diário e minuto; aplicar também a Geocoding e Distance Matrix legado. Quota por minuto sozinha não impede gasto mensal. Não tratar alerta Billing como corte de serviço. Registrar valores efetivos e fuso de reset antes da ativação de produção.
7. Habilitar chamadas somente no ambiente autorizado. Para cada ação humana, revisar popup e confirmar uma vez. Cada nova tentativa exige nova confirmação e permanece dentro dos tetos globais. O grant expira; mudar limites/preços revoga grants antigos.
8. Se habilitar WhatsApp, escolher explicitamente política `whatsapp_agenda`, seus três limites de chamadas/custo e SKUs. A chave de execução é o ID persistido do job; repetir o job não gera novo orçamento. Jobs sem Google não precisam dessa política. Outras automações continuam sem autorização até integração nominada.
9. Verificar painel/histórico e quotas após ativação. Medir tentativas/reservas por ação e confrontar Billing após seu processamento. Erro/timeout não devolve reserva automaticamente, pois pode ter sido cobrado.

## Bloqueios e recuperação

- Ausência de configuração, validade expirada, teto atingido ou banco indisponível suspende novas consultas Google. A tela mostra o motivo. Não preencher duração/distância manualmente para contornar uma validação de rota sem evidência.
- Operações de agenda comprovadamente gratuitas, como cancelamento, continuam disponíveis. Reativação e buscas que podem calcular rota permanecem protegidas.
- Um bloqueio durante a validação não deve persistir alteração parcial do agendamento. A reserva financeira já usada permanece no ledger mesmo quando a transação operacional é revertida.
- Para interromper gasto, desabilitar chamadas na configuração. Preservar tabelas de ledger e autorizações em backup/restore. Restaurar banco antigo sem conciliar gasto ocorrido depois do backup pode reabrir saldo indevidamente; manter suspenso até conciliação.
- Não fazer rollback removendo a proteção e mantendo chave ativa sem decisão explícita. A migração aditiva pode permanecer instalada.

## Verificação reproduzível

- Backend: `python -m unittest discover -s backend/tests -p 'test_google_maps*.py' -v`; para concorrência real, usar banco PostgreSQL descartável local `maps_cost_test` e `MAPS_COST_TEST_POSTGRES_URL`.
- Frontend: `npx vitest run components/google-maps app/clinicas/geocode-explicit-action.test.tsx`, além de `npm test`, lint e build.
- Stage: `backend/venv/bin/python scripts/google_maps_stage_canary.py`. O script recusa checkout/projeto/ambiente de produção, cria schema próprio e o remove ao final. Declara separadamente recusas por limite e por indisponibilidade de conexão; a disputa usa reservas concorrentes, completa o saldo sintético sequencialmente se necessário e exige bloqueio da chamada seguinte. Não aumente pools ou timeouts apenas para eliminar a recusa: investigue o ciclo de conexões e a capacidade do ambiente. A API real é consultada apenas para comprovar bloqueio; sucesso e corrida usam o código implantado com transporte simulado.
- Auditoria readonly: `backend/venv/bin/python scripts/google_maps_readonly_audit.py`; somente agregados e sem chamadas Google. Não usar as métricas antigas como autorização financeira.

Fontes: [preços oficiais](https://developers.google.com/maps/billing-and-pricing/pricing), [uso e faturamento Routes](https://developers.google.com/maps/documentation/routes/usage-and-billing), [gestão de custos](https://developers.google.com/maps/billing-and-pricing/manage-costs), [faturamento compartilhado](https://developers.google.com/maps/billing-and-pricing/billing-overview).
