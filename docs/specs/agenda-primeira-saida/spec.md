# Spec — Primeira saída da Agenda

Data: 2026-10-07
Responsável: Martiniano + Codex
Status: em execução

## Escopo funcional

O assistente calcula a primeira chegada do dia desde a residência operacional
do profissional. A sugestão e a validação do agendamento usam a mesma regra:
uma primeira chegada precisa caber após a abertura da agenda ou, hoje, após o
instante atual, somando viagem e margem segura. Pisos municipais também limitam
o início. Outros encaixes continuam seguindo os vizinhos reais da agenda.

## Requisitos funcionais

- RF-001: identificar o primeiro atendimento ativo do dia pelo horário real,
  inclusive ao consultar ou salvar um novo atendimento antes dos existentes.
  Reservas expiradas e cancelamentos não viram âncoras operacionais.
- RF-002: usar a base residencial já presente em `agenda_rota_regras.base`
  (endereço/CEP; coordenadas opcionais) para estimar a viagem até o primeiro
  destino georreferenciado. A hora mínima da primeira
  chegada é `max(abertura_da_agenda, agora_local_se_hoje) + viagem + margem`.
  Segundos e frações de minuto são arredondados para cima, sem perder a margem.
- RF-003: aplicar adicionalmente o piso de 08:30 em Caucaia e de 09:00 em
  Maracanaú, Eusébio e Itaitinga. O município é comparado sem depender de
  caixa, acento ou espaços extras. Fortaleza e demais municípios não ganham um
  piso municipal artificial; continuam limitados por RF-002.
- RF-004: quando o piso municipal for mais cedo que a chegada calculada, prevalece
  a chegada calculada. As regras de jornada, duração, preferências e ocupação
  continuam sendo interseccionadas; uma janela insuficiente retorna sem oferta.
- RF-005: se residência, destino ou duração da viagem não estiverem disponíveis
  de forma confiável, não gerar oferta de primeira chegada como se a viagem fosse
  zero. Distância em linha reta ou palpite genérico por cidade/região não são
  duração de rota confiável para esse trecho. O salvamento deve dar erro
  controlado, sem criar o agendamento.
- RF-006: no aceite e no salvamento, recalcular a viabilidade com o relógio e a
  agenda atuais. Uma oferta que era viável e envelheceu não pode ser persistida.
- RF-007: depois que houver atendimento anterior, preservar a validação de
  deslocamento entre vizinhos, inclusive transição no mesmo destino e exceções
  operacionais já autorizadas; a saída de casa não se soma a esses trechos.

## Requisitos não funcionais

- NFR-001 (privacidade): respostas de sugestão/validação, interface do assistente
  e auditoria não revelam endereço ou coordenadas da residência. A configuração
  administrativa existente mantém seu contrato e suas permissões atuais.
- NFR-002 (consistência): geração e salvamento compartilham a mesma política de
  primeira saída e usam horário local de Fortaleza.
- NFR-003 (compatibilidade): sem mutação de agendamentos existentes nem alteração
  das regras de deslocamento entre atendimentos.
- NFR-004 (performance): reutilizar cache de viagem por requisição quando houver
  múltiplos candidatos para o mesmo primeiro destino.

## Contratos técnicos

### API

- `POST /api/v1/agenda/sugestoes-horario`: filtra candidatos antes do ranking e
  do limite de apresentação. A ausência de horário viável retorna lista vazia e
  motivo legível. Metadados de viagem e horário mínimo não expõem o ponto
  residencial preciso.
- `POST /api/v1/agenda/assistente/validar-oferta`: reconsulta uma oferta antes
  do aceite com o relógio e a agenda atuais; informa validade ou motivo para
  atualizar o panorama. É uma consulta de apoio, sem mutação de reservas
  expiradas; o salvamento continua sendo a autoridade contra corridas e contra
  confirmação de reserva expirada.
- `POST /api/v1/agenda`, `PUT /api/v1/agenda/{id}` e fluxos existentes de
  confirmação/reabilitação: revalidam a primeira saída antes da persistência.
  Um horário inviável retorna HTTP 409 com código `PRIMEIRA_SAIDA_INVIAVEL`.
- Canais que reutilizam a sugestão da Agenda herdam o mesmo filtro sem contrato
  novo para pacientes ou tutores.

### Persistência e configuração

- A origem residencial usa `agenda_rota_regras.base` existente. O endereço/CEP
  podem ser usados na estimativa mesmo quando `lat/lng` não estão cadastrados.
  Os pisos ficam em `route_policy.first_appointment_city_floors`, com defaults
  normalizados e editáveis na configuração operacional.
- Não há mudança de esquema dos agendamentos nem migração prevista.

### Interface

- O panorama apresenta somente horários viáveis e informa de modo acionável
  quando nenhum horário atender à viagem ou aos pisos.
- Uma oferta selecionada deve ser verificada novamente antes de ser salva;
  falhas ficam visíveis dentro do modal e não equivalem a agendamento criado.

## Critérios de aceitação

- CA-001: às 08:24 em Fortaleza, primeiro atendimento às 08:30 não é ofertado
  quando a viagem desde casa e a margem não cabem; horário posterior alcançável
  pode ser ofertado.
- CA-002: em data futura, o primeiro horário em Fortaleza ou município sem piso
  é limitado pela abertura da agenda mais viagem e margem, mesmo sem evento
  anterior.
- CA-003: Caucaia não tem oferta antes de 08:30; Maracanaú, Eusébio e
  Itaitinga não têm oferta antes de 09:00. Variações de acento/caixa do município
  produzem o mesmo resultado.
- CA-004: viagem longa que ultrapasse o piso municipal desloca a oferta até a
  chegada viável; piso municipal jamais encurta a viagem.
- CA-005: sem geolocalização ou viagem confiável, não há primeira oferta
  presumindo deslocamento zero, linha reta ou constante regional, e a tentativa
  de salvar falha sem persistência.
- CA-006: às 08:24:59, uma chegada necessária após 08:30 não é arredondada para
  baixo; borda exatamente viável pode ser aceita.
- CA-007: oferta gerada antes do horário limite e salva depois de envelhecer é
  reprovada na revalidação; a interface mostra o erro no contexto do modal.
- CA-008: encaixe com atendimento anterior no mesmo dia conserva somente a
  validação de vizinhos, sem impor novamente a saída residencial.
- CA-009: duração do serviço, janela operacional, preferências, bloqueios e
  reservas continuam limitando as sugestões como antes.

## Compatibilidade e rollback

Sem alteração automática de registros existentes. Reversão do código restaura
o comportamento anterior de sugestão/validação; configuração residencial
aditiva pode permanecer sem afetar versões antigas. Testes de integração usam
banco temporário e dados sintéticos. Publicação exige ciclo protegido posterior.
