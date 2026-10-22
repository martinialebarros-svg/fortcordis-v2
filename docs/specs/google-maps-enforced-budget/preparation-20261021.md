# Preparação para revisão — 21/10/2026

Escopo autorizado: concluir preparação e demonstração em stage. **Sem reativar, configurar, reiniciar ou publicar produção.** Agenda humana em `monitor`; limites diários/mensais geram alerta, enquanto extras obedecem ao teto compartilhado. Uma confirmação permanece finita e vinculada à ação.

## Histórico e proposta

Julho: 13.062 Compute Routes Essentials, R$ 90,12; agosto: 22.806, R$ 372,45. Admitindo apenas como cenário 10.000 unidades gratuitas por mês, o custo efetivo acima da franquia foi R$ 0,0294317 e R$ 0,0290832 por unidade. Isso é uma inferência de duas faturas, não um preço contratado ou prova de saldo gratuito atual.

Proposta inicial, ainda não aprovada nem ativada:

| Período | Chamadas compartilhadas | Estimativa conservadora compartilhada | Comportamento |
| --- | ---: | ---: | --- |
| Dia | 650 | R$ 25 | Agenda alerta e continua; extras bloqueiam ao atingir qualquer referência |
| Mês | 13.000 | R$ 500 | Agenda alerta e continua; extras bloqueiam ao atingir qualquer referência |

13.000 aproxima o volume de julho (0,5% abaixo). 650/dia fica entre as médias corridas de julho (421) e agosto (736); é referência de alerta, não dimensionamento comprovado de pico. O custo estimado considera **todas** as unidades, sem franquia ou descontos. USD 0,005 Essentials/Geocoding, USD 0,01 Pro; câmbio superior proposto de R$ 6/USD e multiplicador 1,20, ambos parâmetros de proteção, não cotação atual nem taxa tributária comprovada: R$ 0,036 Essentials/Geocoding e R$ 0,072 Pro por tentativa. Não cobrar do usuário por esse valor nem chamá-lo de fatura. Preços públicos reconsultados em 21/10; revalidar antes da ativação e até a validade 21/11, com revisão antecipada se houver alteração de preço/câmbio.

Com 13.000 chamadas exclusivamente Essentials e franquia inteira disponível, cenário de fatura R$ 87–108; **sem** franquia, a reserva conservadora seria R$ 468. Com mistura de SKUs, tentativas adicionais, compartilhamento da conta, tributos ou câmbio diferente, esse cenário muda. A Agenda pode exceder a referência; não há garantia de conta final máxima.

Alternativas para escolha: 16.000/R$ 600 mensal (mais folga; cenário Essentials com franquia R$ 174–216) ou 23.000/R$ 850 (acomoda volume de agosto; cenário R$ 378–468). Não converter proporções das faturas em saldo gratuito garantido. Referências em reais e chamadas são verificadas independentemente.

## Autorizações por ação e extras

O rascunho validado em `proposed-monitor-config.json` está **enabled=false**, sem baseline ou automações habilitadas. O teto de segurança é 64 unidades por criação/alteração/validação/reserva, 1.024 por busca de um dia, 4.096 por proximidade/ofertas e 1 Geocoding para endereço domiciliar. O popup real mostra o máximo correspondente, inclusive SKU mais caro e fallback; os exemplos da demonstração usam 4 unidades e até R$ 0,288. Os máximos das buscas amplas são envelopes de segurança, não previsão de consumo: o cadastro fictício de stage não comprova o pico de produção. Não reduzir esses números em produção sem observar consultas representativas; não tratar o teste sintético como equivalência de rotas reais.

Consulta avulsa: até 2 unidades, geocodificação avulsa: 1, com confirmação e limites diários/mensais rígidos. Recalcular matriz completa, assistente IA e tarefas automáticas: **zero novas chamadas na proposta inicial**. Uma matriz de 178 clínicas pode precisar de 31.506 unidades (63.012 com fallback); não liberar silenciosamente usando o envelope da Agenda. Futuro lote/automação exige política própria e revisão específica. `limits.action.estimated_brl=5` vale para extras; Agenda tem o máximo monetário derivado das unidades cotadas, sem consumir autorização permanente.

## Preparação técnica e limites da apuração

- A leitura de produção, sem mutações, encontrou checkout `ac054398`, APP_ENV `development`, liberação temporária true, cache-first false e nenhum orçamento configurado. API/worker/frontend ativos. Preparar o diff de ambiente com `APP_ENV=production`, `GOOGLE_MAPS_AGENDA_CACHE_FIRST=true` e emergência ainda true. Validar `Settings(APP_ENV='production')` sem gravar nada, verificando banco e projeto de produção. **Aplicar e reiniciar apenas após autorização de publicação.**
- Telemetria consultada em 21/10: 6.231 Routes em outubro, 121 no dia local; não é Billing e não cobre integralmente Geocoding/tentativas não registradas. Última evidência do console até 18/10: 6.114 Routes e 21 Geocoding. Não subtrair uma fonte da outra para inventar saldo. Atualizar a coleta no instante de ativação.
- Atualização autenticada do console nesta preparação (relatório 1–21/10): **6.388 Routes Essentials e 23 Geocoding, R$ 0 reportados**, previsão automática R$ 7,47. A diferença de 157 Routes para a leitura da aplicação não foi atribuída causalmente. Logs sanitizados da liberação desde 18/10 contêm 373 tentativas Routes Essentials e 2 Geocoding; sobrepõem-se à telemetria e não devem ser somados a ela. A projeção Google não é teto nem saldo autorizado.
- O dry-run `Settings(APP_ENV='production')` foi válido, com segredo forte presente, mesmo banco, projeto de produção confirmado e emergência preservada. Nenhum arquivo de produção foi modificado. A mudança efetiva de identidade e o restart pertencem à publicação futura autorizada, não a esta preparação.
- Franquia é compartilhada por SKU/conta e reinicia no fuso do Pacífico; ledger local usa Fortaleza. Billing pode atrasar até 48h. O baseline deve incluir a liberação e eventuais lacunas; não iniciar zero, não somar logs com métricas que representam a mesma chamada. Se não houver limite superior confiável, manter extras sem novas chamadas; não declarar reconciliação completa.
- Quotas nativas compartilhadas pequenas também bloqueiam a Agenda. Não alteradas. Para segunda barreira independente dos extras, separar projeto/credenciais e revisar franquia compartilhada; nenhuma promessa de isolamento por chave somente.
- O diff stage/main contém 13 caminhos clínicos da revisão felina fora desta autorização. Antes de uma futura promoção protegida `stage → main`, preservar seus conteúdos de produção e restaurar stage posteriormente. O pacote Maps deve ser revisto em isolamento, sem reverter autenticação recém-publicada ou promover alterações clínicas incidentalmente.
- Não copiar cadastros/endereço reais para stage. Endereços fictícios/incompletos não serão corrigidos para passar testes. Demonstração UI sem API e canário em schemas descartáveis, transportes interceptados; sem Google real ou gravações em registros operacionais.

## Roteiro da demonstração em stage

Configurações → Custos Google Maps → Experimentar o controle sem gerar custo. A tabela mostra a proposta sem salvá-la. “Rota já armazenada” usa cache sem custo/popup; “Nova consulta” abre popup finito; Cancelar mantém formulário sem envio; Confirmar permite uma ação; “Referência atingida” alerta e permite Agenda; “Lote bloqueado” explica a suspensão do extra. Todos esses botões simulam, sem APIs ou agendamento.

## Sequência após revisão e autorização futura

1. Revalidar SHAs/diff, ambiente, banco, preços e baseline naquele instante. Não usar o rascunho desabilitado como configuração efetiva.
2. Isolar delta clínico e dependências; promover apenas snapshot aprovado pelo fluxo protegido. Preservar/restaurar runtime, esperar gates/deploy terminais.
3. Manter emergência true durante instalação e executar a [transição com drenagem](activation-cutover.md): parar emissores antigos, fechar o baseline, persistir orçamento monitorado antes de iniciar API/worker sem emergência e comprovar a política efetiva. Não coletar um baseline e deixar chamadas liberadas sem contabilização até um restart posterior. Sem baseline superior confiável, todos os extras permanecem com teto zero; a Agenda segue sua política de confirmação finita e referências.
4. Se houver incidente, recolocar emergência true e reiniciar/verificar processos: reversível, mas suspende limites e pode gerar cobrança sem teto. Não apagar ledger ou inventar rotas.

Fontes: [preços Google](https://developers.google.com/maps/billing-and-pricing/pricing), [franquia/conta](https://developers.google.com/maps/billing-and-pricing/overview), [quotas e atraso Billing](https://developers.google.com/maps/billing-and-pricing/manage-costs), evidências privadas sanitizadas em `/Users/martiniano/Documents/Codex/2026-10-21/maps-activation-preparation/`.
