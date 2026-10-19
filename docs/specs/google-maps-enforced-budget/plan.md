# Plano de implementação e entrega

## Incremento vigente — controle sem interrupção global da Agenda

1. Corrigir a antecipação do bloqueio: contexto local autenticado, sem consulta ao ledger antes de saber se há envio Google.
2. Manter cache confiável; impedir nova heurística após falha. Conservar grants/limites/concorrência no transporte e a atomicidade de Agenda.
3. Acrescentar no cliente uma única repetição exclusivamente após resposta de consentimento do servidor; popup antes da nova execução paga e dados do formulário preservados.
4. Exibir demonstração administrativa sem custo, com exemplos explicitamente fictícios e a limitação de uma rota inédita sem saldo.
5. Testar PostgreSQL descartável, criação real de agendamento sintético com cache, falha do ledger, cancelamento, replay e concorrência. Validar o código instalado em stage em schemas isolados, sem Google ou alterações de dados operacionais.
6. Publicar somente em stage e comprovar SHA, serviços, HTTP/bundle, canário e preservação de runtime. Deixar produção no modo emergencial vigente e demonstrar o resultado ao usuário antes de qualquer reativação.

## Liberação emergencial solicitada em 19/10/2026

O usuário informou que a recepção não consegue agendar e autorizou: “Deixe liberado por enquanto”. Esta instrução suspende a ativação do modo R$ 0 e autoriza temporariamente as consultas potencialmente cobradas. A observação instalada mostrou `reason=unconfigured`, revisão 0 e nenhuma política aprovada; o bloqueio ocorria antes de qualquer consulta Google. Não houve ativação de quota nativa zero.

`GOOGLE_MAPS_COST_EMERGENCY_RELEASE=true`, exclusivamente no servidor, libera temporariamente preview/execução/provedores, inclusive tarefas automáticas. Default `false`. Não altera autenticação, permissões funcionais, regras de deslocamento, cache ou registros de agenda. Nenhum preço, baseline, saldo gratuito ou teto financeiro é inventado. Preview retorna `required=false`, `operation_mode=temporary_open` e máximos de chamadas/custo `null`. O painel administrativo mostra a suspensão e oculta controles que não surtiriam efeito durante a exceção.

Cada tentativa de provedor registra aviso sem chave/endereço/payload, com SKU e custo desconhecido. O ledger anterior fica preservado; não representa nem contabiliza o gasto desta exceção como R$ 0. A conciliação desse intervalo é obrigatória antes de voltar a orçamento pago. A exceção não depende de ler o ledger: indisponibilidade dele não deve reproduzir a interrupção operacional autorizadamente removida. A autenticação e o banco de negócio continuam necessários.

Encerrar a liberação requer retirar a flag (ou `false`) e reiniciar API e worker. A decisão é relida em cada chamada; um contexto temporário não mantém autorização após a flag desligada. Sem configuração aprovada, isso volta a bloquear agendamentos dependentes de Maps. Portanto, não reativar os controles sem resolver e validar antes a política operacional escolhida. Não há prazo ou teto financeiro presumido.


1. Rastrear frontend → endpoint → serviço → transporte Google; inventariar leituras, lotes, ferramentas IA e worker WhatsApp. Cruzar histórico Git e métricas agregadas readonly com Billing, separando observação e hipótese.
2. Corrigir renovação de TTL após revalidação Google bem-sucedida mesmo sem alteração dos valores, preservando ajustes manuais.
3. Criar ledger independente da transação de negócio, configuração persistida, grants vinculados à requisição/usuário, expiração e consumo único. Serializar reservas no PostgreSQL e SQLite; indisponibilidade fecha o acesso pago.
4. Proteger os três emissores (Routes, Distance Matrix, Geocoding) antes do transporte. Falha financeira não pode gerar fallback pago ou uma rota inventada.
5. Preflight sem Google, confirmação explícita e popup global acima dos modais. Remover geocodificação disparada por blur; manter botão explícito.
6. Administrar configuração, consumo e bloqueios; automações desabilitadas até política explícita e orçamento próprio.
7. Testar cancelamento, replay, concorrência multiprocesso/PostgreSQL, acesso direto, banco indisponível, limite por SKU, persistência, privacidade e cache; verificar UI e documentação. Validar stage com isolamento e fixtures.
8. Entregar snapshot, evidências e opções de limites para decisão. O primeiro ciclo foi publicado somente em stage; a autorização posterior abaixo substitui a pendência de decisão para o modo sem novos envios.

## Incremento autorizado: produção com custo adicional zero

1. Registrar separadamente os agregados readonly do aplicativo e o relatório autenticado do Google de 1–18/10, sem declarar saldo gratuito em tempo real ou conciliar automaticamente pagamentos anteriores.
2. Acrescentar `operation_mode=cache_only` com limites de zero chamadas/R$ 0 por ação, dia e mês. Não exigir nem enviar preços, câmbio ou baseline nesse modo; preservar o histórico existente. Manter `paid_budget` como contrato legado com validação financeira completa.
3. Permitir preview sem popup de custo (`required=false`, zero chamadas, sem quote/grant pago) e contexto limitado a cache. Bloquear todos os transportes Google, inclusive falhas/fallbacks, requisições diretas, automações e mudança concorrente de configuração.
4. Usar apenas cache Google ainda válido ou ajuste manual persistido/autorizado. Exigir TTL positivo e validade verificável para cache Google, ou `manual_override=true` para ajuste autorizado. Bloquear cache ausente, expirado, heurístico, TTL zero/negativo e cache de sessão da primeira saída sem timestamp; preservar as validações e a atomicidade da agenda.
5. Exibir a escolha “R$ 0 — somente cache” no painel, sem campos financeiros artificiais; explicar o bloqueio na tela da ação. Uma futura escolha `paid_budget` precisa de configuração explícita e nova autorização para gasto.
6. Validar backend/PostgreSQL, providers, jobs, transações, UI, mudança de modo, persistência e falha do banco com dados sintéticos. As provas do ciclo anterior não substituem os novos testes.
7. Isolar os 13 caminhos clínicos fora do escopo, promover por PR direto stage→main, acompanhar gates/deploy/smoke e confirmar a configuração `cache_only` persistida. Confirmar que API/workers foram reiniciados no snapshot aprovado; uma reserva paga anterior pode estar em trânsito e não é cancelada pela configuração. A primeira ativação parte de guard sem orçamento habilitado. Preservar os seis arquivos de runtime e os registros reais. Restaurar a revisão clínica em stage depois da promoção.
8. Registrar o resultado instalado e o estado efetivo das quotas nativas. As quotas observadas inicialmente estavam ilimitadas por dia; nenhuma alteração foi comprovada neste documento. Não tratá-las como barreira ativa.

Estado deste incremento: implementação e validações locais concluídas; backend integral aprovado (1.991 testes, 69 skips, zero falhas/erros). Frontend integral aprovado (980 Vitest/107 arquivos e 23 Node), além de 20 focados Maps, lint, TypeScript e build. Stage, produção, configuração efetiva, quotas nativas e restauração clínica continuam pendentes; detalhes e limites em `verify.md`.

Rollback seguro: desabilitar novas chamadas na configuração e manter o ledger; reverter a proteção restauraria o risco de gasto e exige decisão explícita. A migração é aditiva e não remove dados operacionais.

## Encerramento operacional do hotfix

Reintegrar o hotfix de produção em stage junto da restauração byte a byte dos 13 caminhos clínicos de cb93d4c6. Preservar mudanças fiscais já integradas em 55068935/21035136. Manter os registros históricos da auditoria e canário isolado, sem executar a ativação de cache_only suspensa. Conferir flag efetiva na API, reinício do worker e canário recepção sem escrita; acompanhar os dois deploys até terminal.
