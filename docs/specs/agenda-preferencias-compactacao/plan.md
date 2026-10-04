# Plan — Preferências e compactação da Agenda

1. Isolar a implementação a partir de `origin/stage` (3764bfbd), preservando o
   checkout principal e alterações de outros trabalhos.
2. Adicionar contrato opcional e validado de preferência aos três caminhos de
   sugestão: dia, proximidade e orquestrador. Restringir geração, classificação
   de âncoras e busca progressiva antes do ranking e do limite de apresentação.
3. Gerar candidatos nos limites reais dos eventos, separando a transição no
   mesmo destino da margem de deslocamento. Preservar o catálogo de duração e
   as validações operacionais finais.
4. Expor período e turno antes de gerar no modal; invalidar ofertas ao mudar
   filtros e impedir resposta antiga de restaurar opções incompatíveis.
5. Propagar preferências no WhatsApp e na consulta da IA administrativa usando
   o mesmo núcleo. Não enviar mensagens nem realizar reservas nos testes.
6. Executar testes sintéticos de integração e regressões relevantes, revisar o
   diff, verificar tipos/lint/build frontend e guardrail SDD; registrar evidência.

Ficam para uma evolução específica: otimizador global de roteiro, remanejamento
de horários já confirmados, preferência permanente da clínica, alteração do
histórico de duração, métricas novas em produção e publicação.
