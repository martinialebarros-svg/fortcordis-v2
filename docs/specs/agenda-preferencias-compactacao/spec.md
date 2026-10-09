# Spec — Preferências e compactação da Agenda

Data: 2026-10-04
Status: publicado em produção; evidências e limites registrados em verify.md

## Comportamento

- RF-001: antes de gerar ofertas, a recepção pode escolher sem preferência, data
  específica, esta semana, próxima semana ou intervalo, além de qualquer turno,
  manhã, tarde ou faixa de horário. Preferência pertence ao pedido atual.
- RF-002: datas relativas são resolvidas em America/Fortaleza, com referência
  estável da sessão/solicitação e datas explícitas para conferência. Próxima
  semana é a segunda a domingo seguintes; jornada e feriados continuam válidos.
- RF-003: período informado é restrição. Nenhuma oferta/proximidade ou busca
  progressiva pode sair dele silenciosamente; ampliar depende de alterar os
  filtros. Ausência de opções no período não afirma indisponibilidade global.
- RF-004: o exame completo deve caber na interseção entre preferência e janela
  operacional. Manhã termina até 12:00; tarde começa às 12:00 e termina até
  18:00, respeitando eventual encerramento anterior do expediente.
- RF-005: filtrar preferências antes de ranquear/limitar. Uma âncora fora do
  turno pedido não elimina candidatos aderentes; ocupações fora do turno ainda
  participam das verificações de conflito e deslocamento.
- RF-006: a divisão visual do calendário não limita a geração. Além dos slots
  regulares, gerar candidatos compactos antes/depois dos eventos existentes,
  usando a duração do catálogo e o intervalo operacional apropriado. Para hoje,
  bordas exatas usam a antecedência real, antes do arredondamento da grade. A
  exceção estreita de adjacência de rota usa 30 minutos mais margem, independente
  da grade visual ou do passo solicitado para gerar sugestões.
- RF-007: `thresholds.same_location_transition_min` define troca/preparo no mesmo
  destino (default 5 min); `safe_margin_min` continua a margem de viagem entre
  destinos. Zero explícito é válido e não deve virar o default por coerção.
- RF-008: geração, risco, adjacência, ranking e validação de novos encaixes usam
  a mesma transição. Deslocamento real, bloqueios, reservas não expiradas,
  concorrência e autorização de exceções continuam protegidos.
- RF-009: alteração de preferência invalida ofertas e aceite anteriores. Uma
  resposta atrasada não pode restaurar oferta incompatível com os filtros atuais.
- RF-010: WhatsApp reconhece também esta/próxima semana, aplica turno antes da
  busca e preserva a preferência na revalidação. A consulta continua sem reserva,
  sem escrita de agendamento e sem revelar dados de outros pacientes.
- RF-011: preferência seguramente interpretada acompanha a preparação do pedido
  WhatsApp para o modal. Texto desconhecido permanece para revisão humana.
- RF-012: a ferramenta administrativa de disponibilidade aceita o mesmo contrato
  e respeita o período na enumeração de dias e nas chamadas ao núcleo da Agenda.
- RF-013: a medição operacional é executada sob demanda, em transação PostgreSQL
  somente leitura, sem importar o runtime da aplicação. A saída contém apenas
  agregados, separa intervalos persistidos da sensibilidade ao catálogo atual e
  exclui membros de sobreposições das folgas elegíveis. Comparações pré/pós usam
  semanas completas; registros futuros ou criados após o deploy não comprovam
  atendimento realizado nem uso do novo motor. Amostra insuficiente e ausência
  de atribuição causal devem permanecer explícitas.
- RF-014 (evolução 2026-10-05): para um atendimento com data específica e
  disponibilidade "A partir de HH:mm", aceitar somente `hora_inicio`. O início
  é inclusivo e restringe candidatos antes do ranking e do limite de ofertas;
  o encerramento vem da interseção com jornada e turno, sem inventar um término
  no pedido. O exame completo precisa caber. `hora_fim` isolado é inválido.
- RF-015: o modal distingue "A partir de" da faixa fechada, importa ambas sem
  ampliar a restrição recebida e invalida ofertas antigas ao trocar data ou
  horário. Quando não houver vaga após o início informado, retorna lista vazia
  explicativa, sem oferecer horários anteriores.

## Contrato

Os payloads de sugestão aceitam `preferencia` opcional:

```json
{
  "data_inicio": "2026-10-05",
  "data_fim": "2026-10-11",
  "turno": "tarde",
  "hora_inicio": null,
  "hora_fim": null
}
```

Datas são inclusivas, devem vir em par, ordenadas, com no máximo 31 dias.
Uma faixa fechada usa `hora_inicio` e `hora_fim` em par, no formato HH:mm e em
ordem crescente. A opção "A partir de" usa apenas `hora_inicio`; `hora_fim`
isolado não é aceito. O limite inicial é inclusivo e não amplia o expediente.
Turno é `qualquer`, `manha` ou `tarde`. Ausência de preferência preserva a busca
legada sem restrição explícita de datas. Não há migration: a nova transição usa
o JSON existente de regras e as preferências transitam no pedido/consulta.

## Aceitação

- CA-001: eco 09:30–10:10, mesma clínica, transição 5 e grade visual 30 permite
  sugestão às 10:15 com duração de 40 minutos; não exige esperar até 10:30.
- CA-002: com transição zero explícita, encaixe às 10:10 não recebe risco de
  viagem artificial; duração do serviço permanece 40 minutos.
- CA-003: sequência de quatro exames de 40 minutos pode ocupar 08:30–11:25 com
  três transições de 5 minutos, sem sobreposição e sem alterar eventos existentes.
- CA-004: pedido de manhã com âncora às 15:00 ainda recebe opções matinais
  viáveis. Nenhum exame ultrapassa 12:00 quando essa é a restrição.
- CA-005: próxima semana recebida no domingo usa a segunda seguinte, conserva
  a referência ao reabrir a consulta e nunca oferece antes/depois do intervalo.
- CA-006: ausência de vagas no intervalo produz lista vazia explicativa; não
  aciona fallback para outra semana ou turno.
- CA-007: viagens reais e bloqueios continuam impedindo candidatos inseguros;
  reservas expiradas liberam a ocupação conforme a regra já existente.
- CA-008: preferência importada do WhatsApp preenche os filtros e é enviada ao
  gerar; mudar turno durante uma requisição invalida a resposta antiga.
- CA-009: canais usam a mesma semântica de preferências e encaixes, preservando
  seus limites de apresentação e os controles humanos de confirmação.
- CA-010: o coletor reproduz o baseline agregado de setembro e informa ausência
  de observações pós-publicação em semanas completas no dia do deploy, sem
  converter folgas teóricas em atendimentos adicionais. Rejeita banco diferente
  do esperado e não imprime credenciais, identificadores ou conteúdo clínico.
- CA-011: com 16/10/2026 livre, jornada 08:00–18:00 e serviço de 40 minutos,
  data específica e "A partir de 09:00" produzem ofertas a partir de 09:00;
  nenhuma das primeiras opções exibidas começa às 08:00 ou 08:15.
- CA-012: início no fim da jornada, turno incompatível ou janela menor que a
  duração retornam vazio sem ampliar data/turno; faixa fechada, fim isolado e
  alteração de filtro preservam suas validações e invalidam ofertas antigas.

## Limites e rollout

Não reduz duração clínica, não move pacientes automaticamente e não atribui
ganho financeiro a minutos fragmentados. Publicação e validação operacional em
stage e produção foram concluídas em 04/10/2026, conforme verify.md, pelo PR
protegido de promoção #301. Rollback por reversão do código; o campo
aditivo no JSON é ignorável por versões anteriores.

A evolução RF-014/015 e CA-011/012 foi solicitada em 05/10/2026 e está em
implementação local; o status de publicação acima se refere à entrega de
04/10/2026.
