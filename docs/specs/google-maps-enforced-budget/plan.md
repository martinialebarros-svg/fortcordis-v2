# Plano de implementação e entrega

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
