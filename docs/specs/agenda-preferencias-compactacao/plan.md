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
7. Publicar pelo fluxo protegido stage → main e validar a versão instalada,
   API e interface autenticadas, preservação de runtime e recuperação do backup.
8. Consolidar as evidências de produção e a correção DNS/TLS do alias de stage.
9. Disponibilizar extração agregada somente leitura para repetir o baseline e
   comparar períodos completos pré/pós publicação, destacando sobreposições,
   insuficiência de amostra e limites de atribuição causal.

Ficam para uma evolução específica: otimizador global de roteiro, remanejamento
de horários já confirmados, preferência permanente da clínica, alteração do
histórico de duração e instrumentação adicional no runtime de produção.
A medição operacional agora autorizada utiliza os registros já existentes,
sem criar agendamentos ou confundir folgas programadas com ganho clínico real.

## Evolução local — limite inicial aberto (2026-10-05)

1. Reproduzir, com agenda sintética vazia em 16/10/2026, que limitar as ofertas
   antes de aplicar a preferência deixa apenas os primeiros horários do dia.
2. Acrescentar ao modal a opção "A partir de" com horário inicial obrigatório,
   preservando a faixa fechada que exige início e fim. Enviar a data específica
   e o início como preferência do pedido; invalidar ofertas quando o filtro muda.
3. Aceitar `hora_inicio` sem `hora_fim` no contrato da Agenda. Intersectar o
   limite inferior com jornada e turno antes do ranking e do limite de exibição,
   exigindo que o exame completo caiba na janela resultante. Manter fim isolado
   inválido e impedir ampliação silenciosa quando não houver vaga.
4. Cobrir o caso de 16/10 após 9h, importação dos filtros, transições entre
   tipos de faixa e regressões de jornada, conflito e duração com testes locais.
5. Atualizar especificação e verificação com resultados locais. Publicação,
   se solicitada, segue o fluxo protegido já documentado.
6. Na integração de 08/10 com a regra de primeira saída, ajustar testes às
   ofertas válidas após a abertura e fornecer base sintética às fixtures
   antigas de duração/reserva; manter a validação operacional intacta.
