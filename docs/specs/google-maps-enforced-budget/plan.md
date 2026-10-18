# Plano de implementação e entrega

1. Rastrear frontend → endpoint → serviço → transporte Google; inventariar leituras, lotes, ferramentas IA e worker WhatsApp. Cruzar histórico Git e métricas agregadas readonly com Billing, separando observação e hipótese.
2. Corrigir renovação de TTL após revalidação Google bem-sucedida mesmo sem alteração dos valores, preservando ajustes manuais.
3. Criar ledger independente da transação de negócio, configuração persistida, grants vinculados à requisição/usuário, expiração e consumo único. Serializar reservas no PostgreSQL e SQLite; indisponibilidade fecha o acesso pago.
4. Proteger os três emissores (Routes, Distance Matrix, Geocoding) antes do transporte. Falha financeira não pode gerar fallback pago ou uma rota inventada.
5. Preflight sem Google, confirmação explícita e popup global acima dos modais. Remover geocodificação disparada por blur; manter botão explícito.
6. Administrar configuração, consumo e bloqueios; automações desabilitadas até política explícita e orçamento próprio.
7. Testar cancelamento, replay, concorrência multiprocesso/PostgreSQL, acesso direto, banco indisponível, limite por SKU, persistência, privacidade e cache; verificar UI e documentação. Validar stage com isolamento e fixtures.
8. Entregar snapshot, evidências e opções de limites para decisão. Produção permanece fora desta autorização.

Rollback seguro: desabilitar novas chamadas na configuração e manter o ledger; reverter a proteção restauraria o risco de gasto e exige decisão explícita. A migração é aditiva e não remove dados operacionais.
