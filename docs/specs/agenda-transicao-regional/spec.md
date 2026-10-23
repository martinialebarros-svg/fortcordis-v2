# Spec - agenda-transicao-regional

Data: 2026-10-22
Responsavel: Codex
Status: in-progress

## Requisitos funcionais

- RF-001: manter o teto habitual de `thresholds.max_neighbor_travel_min` (30
  minutos no cenário solicitado). A mudança regional é habilitada explicitamente
  por `route_policy.regional_transition_enabled`, inicialmente falsa por padrão.
- RF-002: habilitada a política, avaliar a sequência cronológica completa
  resultante da inserção ou remarcação. Admitir no máximo um trecho entre
  atendimentos maior que o teto habitual e menor ou igual a 50 minutos.
- RF-003: exigir a duração real do trecho longo mais 15 minutos de margem total,
  inclusive quando próximo a uma âncora. A margem regional não se soma aos cinco
  minutos habituais: substitui a margem do trecho longo pelo mínimo de 15.
- RF-004: rejeitar trecho de 51 minutos, segunda transição longa, folga
  insuficiente, sobreposição, desvio de inserção proibido ou fim fora da jornada.
  A exceção regional não deve contornar as demais validações.
- RF-005: recalcular a quota a partir dos vizinhos reais após cada reserva. Um
  encaixe curto no bloco já formado pode continuar disponível. Cancelados e
  expirados não entram no cálculo; a remarcação exclui o próprio registro. Para
  preservar compromissos confirmados antes da política, uma sequência que já
  exceda a quota pode manter ou reduzir o número de trechos longos, sem aumentar
  o total existente. Um trecho fixo anterior de mais de 50 minutos não é aprovado
  novamente pela exceção regional; novos trechos continuam limitados a 50.
- RF-006: validar a saída da base separadamente, sem incluí-la na quota de trechos
  entre atendimentos. Preservar os demais contratos da primeira chegada.
- RF-007: ofertar e validar o salvamento com o mesmo avaliador de transição. Os
  resultados devem explicar limite, margem e número de transições em uso.
- RF-008: oferecer uma consulta diária de oportunidades entre clínicas recorrentes
  com rotas confiáveis já salvas, sem chamadas pagas ao Google. A seleção mantém
  viabilidade e preferências. Para cada clínica, selecionar um horário compacto
  viável e calcular o acréscimo de deslocamento: soma dos trechos do encaixe menos
  o trajeto direto que seria substituído, ou a viagem adicionada no fim da rota.
  Ordenar primeiro por faixa de dez minutos desse acréscimo (`minutos // 10`),
  depois por mais dias realizados, mais atendimentos realizados e menor acréscimo
  exato. Assim, a recorrência prioriza opções de custo semelhante.
- RF-009: o ranking usa os 60 dias completos anteriores a hoje, em horário local,
  pela data do atendimento e status `Realizado`. Mais dias distintos é o critério
  principal de recorrência; volume de atendimentos é desempate. Em 22/10/2026, a
  janela é 23/08/2026 a 21/10/2026. O histórico não garante demanda na sexta-feira.
- RF-010: em oportunidades, uma direção ausente, vencida ou sem evidência
  confiável invalida somente candidatos que dependam dela. Continuar a busca
  cronológica da clínica e preservar candidatos válidos já acumulados. Não
  inferir o sentido inverso, não usar zero como duração desconhecida e não
  consultar providers para completar a matriz.
- RF-011: representar explicitamente estimativas desconhecidas de trechos
  existentes no avaliador regional. Isso não deve abortar inserções normais
  conhecidas; uma nova exceção regional continua exigindo evidência nos trechos
  da rota resultante para provar sua quota. Um encaixe cujo acréscimo dependa de
  trajeto direto desconhecido não participa do ranking. O contador
  `sem_estimativa` descreve clínicas sem oportunidade avaliável, não clínicas
  que preservaram opções válidas parciais.
- RF-012: o Completar dia solicita e exibe todas as clínicas com oportunidade
  avaliada para a data e o serviço, sem corte em 20 ou 50 clínicas. Preservar a
  ordem retornada, os horários e as datas das estimativas; mostrar a quantidade
  de clínicas com horários disponíveis. A lista continua sendo uma comparação
  de alternativas independentes, sem criar reservas ou agendamentos.

## Contratos técnicos

`agenda_rota_regras.route_policy` recebe:

| Campo | Padrão |
| --- | --- |
| `regional_transition_enabled` | `false` |
| `regional_transition_max_travel_min` | `50` |
| `regional_transition_margin_min` | `15` |
| `regional_transition_max_legs_per_day` | `1` |
| `recurrent_clinic_history_days` | `60` |

O avaliador `app.services.agenda_regional_transition.avaliar_transicao_regional`
recebe os agendamentos ativos, candidato, regras e resolução de deslocamento. A
resolução reutiliza cache da requisição para reduzir consultas repetidas. A
validação considera direção dos trajetos e falha de forma conservadora quando
não houver evidência confiável para justificar a flexibilização.

`POST /api/v1/agenda/oportunidades-dia` recebe data, serviço opcional e limite.
`limite: null` retorna todas as clínicas encontradas; a UI usa esse modo.
Para compatibilidade, omitir o campo mantém o padrão 20 e limites explícitos
entre 1 e 50 continuam recortando a lista após a ordenação. Esse parâmetro não
altera o limite interno de candidatos de horário avaliados por clínica. A
resposta contém oportunidades por clínica com horários validados, recorrência e
evidência operacional sem dados de pacientes ou contatos, incluindo o acréscimo
de deslocamento. Exige usuário autenticado e papel da equipe da agenda. Não cria
agendamentos nem reservas. A UI exige serviço e consulta por clique, mantém a
ordem retornada e descarta respostas antigas ao mudar data, serviço ou identidade,
fechar o painel ou desmontar o componente.

A configuração usa o JSON já existente, sem migração. A tela de regras de rota
apresenta habilitação, teto, margem, quota e janela histórica. A ausência dos novos
campos mantém a política desativada.

O resolvedor somente cache retorna `(None, "sem_estimativa")` para direção
desconhecida. O motor rejeita esse candidato e retorna o diagnóstico local
`teve_rota_sem_estimativa`, usado para o contador de clínicas excluídas; nenhum
estado diagnóstico é gravado no contexto ou cache compartilhado entre clínicas.

## Requisitos não funcionais

- NFR-001: nenhuma escrita em produção e nenhuma chamada real ao Google na
  validação de stage. O canário deve recusar checkout, projeto ou SHA inesperado.
  O modo de oportunidades usa somente cache e nunca chama a avaliação da
  primeira saída; uma âncora que termine no dia seguinte retorna nenhuma oferta.
- NFR-002: o canário usa schema PostgreSQL descartável, sem `public` no
  `search_path`, removido em `finally`. Nenhum dado clínico ou contato é copiado.
- NFR-003: a configuração é reversível pelo flag; métricas não podem alegar
  ocupação real, demanda confirmada ou atualização de trânsito inexistente.

## Critérios de aceitação

- CA-001: política desligada mantém bloqueio de Zoomare → Uninassau (33 minutos)
  no cenário com teto normal de 30.
- CA-002: ligada, a sexta permite Uninassau (33), Animal Care (41) e Vet World
  (42), preservando Zoomare 09h–09h30 e expediente até 16h30.
- CA-003: trecho exato de 50 minutos permite início às 10h35 após Zoomare;
  10h30 é recusado. Trechos de 51 e 54 minutos são recusados.
- CA-004: ofertas, revalidação e validador usado pelo salvamento concordam nos
  limites de duração, margem e quota.
- CA-005: Zoomare → Uninassau (33) seguido de Uninassau → Vet World (38) é
  recusado; Uninassau → Animal Care (14) continua permitido no mesmo bloco.
- CA-006: Celeiro cancelado não cria conflito nem consome quota; primeira saída
  de 50 minutos é validada separadamente sem consumir a transição regional.
- CA-007: entre alternativas de rota parecida, mais dias distintos realizados
  nos 60 dias completos precede maior volume concentrado. Hoje, fora da janela,
  cancelados e agendados futuros não inflam a recorrência realizada. As faixas de
  acréscimo de deslocamento de dez minutos precedem essa prioridade histórica.
- CA-008: configuração backend/frontend preserva os campos e valida parâmetros;
  instalação de stage corresponde ao SHA aprovado e canário termina com schema
  removido, zero Google e zero alterações operacionais existentes.
- CA-009: a consulta HTTP de oportunidades com âncora legada atravessando a
  meia-noite retorna lista vazia e explicação, sem consultar saída da base ou
  Google. A consulta normal também não aciona a avaliação de primeira saída.
- CA-010: com dois atendimentos ativos, uma direção ausente exigida por um
  candidato inicial não oculta horários posteriores com todos os trechos
  necessários conhecidos; uma ausência tardia não apaga horários já aprovados.
- CA-011: trecho fixo desconhecido não interrompe a avaliação de inserção curta
  conhecida, mas não autoriza nova transição longa quando permanece na rota.
  Rotas dos dois sentidos são independentes, e uma clínica sem qualquer
  candidato com evidência segue contabilizada em `sem_estimativa`.
- CA-012: o canário instalado reproduz a matriz incompleta em schema sintético
  descartável, mantendo 30/50/15/1/60, zero Google e nenhum agendamento
  operacional modificado. A homologação de stage não antecipa a instalação em
  produção, que requer seu próprio deploy terminal e verificação em leitura.
- CA-013: com 31 e com mais de 50 clínicas elegíveis, `limite: null` retorna a
  lista completa e a UI exibe cada clínica, seu horário e a contagem correta.
  Os modos limitados mantêm a mesma ordem e `total_encontrados`. Nenhuma regra
  de recorrência, margem, quota, rota ausente ou autenticação é flexibilizada.
- CA-014: homologar a lista completa primeiro em stage, comprovando ausência
  de alterações em agendamentos, reservas, bloqueios, configuração e matriz
  operacionais. Esta evolução não autoriza publicação em produção.

## Rollout e exclusões

O PR #418 publicou a regra original. A correção do P1 foi homologada pelo
PR #420 em stage `f93a455f`. O usuário autorizou posteriormente sua publicação
em produção e a consulta Completar dia da sexta com Zoomare, sem alterar
agendamentos. A promoção deve conter somente os oito caminhos desse patch
sobre main `4aa1364a`, preservando Maps, PDFs, autenticação, deploy por SHA
aprovado e entregas clínicas de outras sessões. Não há migração ou mudança de
ENV/configuração. Reverter somente o P1 ao snapshot anterior de produção e
preservar os incrementos paralelos. Fora de escopo: enviar ofertas, criar
reservas reais, atualizar rotas pagas, inferir demanda, alterar dados clínicos e
flexibilizar duas transições longas.
