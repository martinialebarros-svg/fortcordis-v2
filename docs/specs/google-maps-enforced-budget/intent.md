# Intenção — limites efetivos de Google Maps

## Endereço do tutor usado no agendamento domiciliar

O botão de georreferenciar endereço dentro da Agenda utiliza `POST /agenda/geocode-endereco-tutor`, ação registrada `agenda_tutor_geocode`, limitada a uma unidade Geocoding por confirmação e vinculada ao endereço exato. Como parte do agendamento humano, essa consulta pode ultrapassar referências em `monitor`, após consentimento. O endpoint cadastral avulso continua sujeito ao teto rígido. Não usar flag arbitrária de payload para promover lote a ação da Agenda. Testar tentativa sem token/cancelamento sem transporte, confirmação de uma unidade, replay negado e preservação da regra do endpoint avulso.

## Decisão operacional atual — 19/10/2026

O usuário escolheu manter a Agenda liberada com alertas quando o orçamento de referência for atingido e aplicar teto rígido somente a lotes/tarefas extras. Implementar essa política em stage, preservando consentimento por ação e registro compartilhado de todos os envios. A Agenda não tem teto financeiro diário/mensal neste modo; os valores não são promessa de custo zero. Não reativar em produção neste ciclo nem escolher números financeiros reais.

## Pedido vigente — ajuste em stage antes de reativar produção

O usuário pediu ajustar o controle sem interromper novamente a Agenda, validar em stage e demonstrar antes de reativar em produção. A liberação temporária de produção permanece ativa; não há autorização para desativá-la, escolher teto financeiro, aplicar quota Google zero ou promover este incremento para main.

Observado: o middleware anterior exigia política/grant antes de descobrir se o endpoint precisaria de Google. A ausência de política bloqueava inclusive validações locais e agendamentos que poderiam usar cache. O novo incremento separa uma tentativa local sem autorização de transporte de uma única execução paga confirmada. Teto rígido não permite confirmar disponibilidade que dependa de uma rota inédita sem saldo: preservar o formulário e as regras, explicar a consulta específica e revisar com o usuário a política para esse caso antes da ativação.

## Liberação emergencial solicitada em 19/10/2026

O usuário informou que a recepção não consegue agendar e autorizou: “Deixe liberado por enquanto”. Esta instrução suspende a ativação do modo R$ 0 e autoriza temporariamente as consultas potencialmente cobradas. A observação instalada mostrou `reason=unconfigured`, revisão 0 e nenhuma política aprovada; o bloqueio ocorria antes de qualquer consulta Google. Não houve ativação de quota nativa zero.

`GOOGLE_MAPS_COST_EMERGENCY_RELEASE=true`, exclusivamente no servidor, libera temporariamente preview/execução/provedores, inclusive tarefas automáticas. Default `false`. Não altera autenticação, permissões funcionais, regras de deslocamento, cache ou registros de agenda. Nenhum preço, baseline, saldo gratuito ou teto financeiro é inventado. Preview retorna `required=false`, `operation_mode=temporary_open` e máximos de chamadas/custo `null`. O painel administrativo mostra a suspensão e oculta controles que não surtiriam efeito durante a exceção.

Cada tentativa de provedor registra aviso sem chave/endereço/payload, com SKU e custo desconhecido. O ledger anterior fica preservado; não representa nem contabiliza o gasto desta exceção como R$ 0. A conciliação desse intervalo é obrigatória antes de voltar a orçamento pago. A exceção não depende de ler o ledger: indisponibilidade dele não deve reproduzir a interrupção operacional autorizadamente removida. A autenticação e o banco de negócio continuam necessários.

Encerrar a liberação requer retirar a flag (ou `false`) e reiniciar API e worker. A decisão é relida em cada chamada; um contexto temporário não mantém autorização após a flag desligada. Sem configuração aprovada, isso volta a bloquear agendamentos dependentes de Maps. Portanto, não reativar os controles sem resolver e validar antes a política operacional escolhida. Não há prazo ou teto financeiro presumido.


Solicitação de 18/10/2026: auditar o crescimento de Routes no Fort Cordis e impedir gasto sem autorização limitada e verificável. Billing informado: julho/2026, 13.062 chamadas e R$ 90,12; agosto/2026, 22.806 chamadas e R$ 372,45, cobrados em setembro. A diferença de volume é 9.744 chamadas (+74,6%).

O resultado deve incluir servidor resistente à concorrência/reinícios, confirmação antes da ação humana que puder gerar custo, política explícita para automações, administração e evidência. Um alerta de orçamento não é um bloqueio.

## Decisão posterior de produção — 18/10/2026

O usuário autorizou a publicação dos controles Maps em produção e determinou que não ultrapassem o teto gratuito. A decisão operacional para cumprir gasto adicional zero é `cache_only`: **zero novos envios ao Google**, com uso somente de rotas Google persistidas ainda válidas ou ajustes manuais já autorizados. Ausência, expiração ou fonte heurística suspendem a operação dependente da rota; não se inventa distância, duração ou disponibilidade.

Esse modo não presume que o restante aritmético da franquia esteja disponível. O console autenticado mostrou 6.114 eventos Routes Essentials e 21 Geocoding, ambos com R$ 0, no relatório de 1–18/10/2026; há atraso de faturamento e lacunas na telemetria antiga. Não transformar esse recorte em autorização para novos envios nem reconstruir pagamentos passados a partir dele.

`cache_only` não exige preços, câmbio ou baseline fabricados. O modo existente `paid_budget` conserva seus requisitos de preço, saldo inicial, limites e confirmação, mas sua ativação não está autorizada nesta publicação. O custo zero refere-se a novos envios deste backend após a ativação; não cancela cobranças de uso anterior ou de consumidores externos.

A promoção será restrita a Maps: isolar os 13 caminhos da revisão clínica felina, mantendo-os iguais à produção `9137d39f` durante a promoção protegida stage→main, e restaurá-los em stage a partir de `cb93d4c6`. Preservar os dados de runtime e registrar validação de stage/produção do novo modo; a autorização não é prova de publicação concluída.

Privacidade: não versionar a evidência privada original, credenciais, endereços, consultas individuais, pacientes ou tutores. Publicar somente agregados e diagnóstico sanitizado. Testes usam fixtures e transporte externo simulado.
