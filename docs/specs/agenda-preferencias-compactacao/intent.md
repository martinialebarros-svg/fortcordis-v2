# Intent — Preferências e compactação da Agenda

Data: 2026-10-04

O usuário relatou intervalos desnecessários entre exames consecutivos na mesma
clínica e pediu que manhã, tarde e próxima semana fossem considerados antes das
sugestões. A auditoria somente leitura de produção identificou quatro exames de
40 minutos em 02/10, na Animal Care, separados por 20 minutos. A grade de busca
de 30 minutos reproduz esse padrão; o deslocamento na mesma clínica já é zero.

Em setembro, o estado consultado continha 143 registros realizados em 24 dias.
As 16 lacunas positivas entre pares consecutivos na mesma clínica somavam 315
minutos programados. Há alterações históricas de duração e horários; esses
números não representam tempo efetivo ocioso nem capacidade adicional garantida.

Objetivo: oferecer horários aderentes ao pedido, aproveitando os limites reais
dos atendimentos e preservando duração, jornada, bloqueios, reservas e viagens.
A entrega foi publicada pelo fluxo protegido de stage e produção, conforme
verify.md, sem mudança dos agendamentos existentes. O complemento autorizado
inclui a conferência visual em produção, regularização do alias de stage,
versionamento das evidências e medição agregada somente leitura da agenda.

## Evolução solicitada em 2026-10-05

Num dia livre, o limite de opções exibidas favorece os primeiros horários.
Para um cliente que só pode em 16/10/2026 depois das 9h, a recepção precisa
declarar um limite inicial sem inventar um término. O objetivo é permitir
"A partir de 09:00" antes de gerar as ofertas, respeitar esse limite na busca
e mostrar horários viáveis nesse dia. A escolha é por atendimento, não altera
agendamentos existentes nem redefine a jornada da clínica.
