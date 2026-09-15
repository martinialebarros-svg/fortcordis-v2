# Intent - whatsapp-lembrete-prontidao-clinicas

## Problema

O lembrete automático de consulta (`whatsapp-lembrete-automatico-consulta`)
já está implementado, mas desabilitado por padrão — o usuário quer revisar
os números de WhatsApp das clínicas parceiras antes de ligar o envio
automático, para não descobrir cadastros quebrados só quando o worker
já estiver rodando.

O preview já existente (`GET /agenda/whatsapp/lembrete-preview`) só lista
agendamentos com consulta dentro da janela de elegibilidade (próximas
~24h) — não serve para auditar o cadastro das clínicas de forma geral,
já que a maioria não tem consulta agendada nas próximas 24h no momento
da revisão.

## Objetivo

Uma auditoria somente leitura, sobre **todas** as clínicas parceiras
ativas (não só as com consulta iminente), que aplica a mesma validação
de número que o envio real usaria (`normalize_whatsapp_number` em
`whatsapp_agenda_service.py`) e reporta quais clínicas não têm número
válido cadastrado — para o usuário corrigir na tela de clínicas antes de
habilitar o worker.

## Escopo

- Nova função de serviço que percorre todas as clínicas `ativo=True`,
  resolve o número que seria usado (mesma lógica de `_resolve_destination`
  do scheduler: primeiro item não-vazio de `whatsapps`, com fallback para
  `telefone`) e valida via `normalize_whatsapp_number`.
- Novo endpoint `GET /agenda/whatsapp/lembrete-clinicas-prontidao`
  (autenticado, mesmo padrão do preview existente).
- Nova seção na tela de Configurações, ao lado do toggle do lembrete
  automático: resumo ("X de Y clínicas ativas prontas") e lista das
  clínicas com problema (nome + motivo), cada uma com link para a tela
  de edição da clínica (`/clinicas/:id`).

## Fora de escopo

- Corrigir os números automaticamente — a correção é manual, na tela de
  clínicas já existente.
- Validar todos os números de uma clínica com múltiplos WhatsApps
  cadastrados — só o que seria efetivamente usado (o primeiro válido).

## Riscos e decisões

- Reaproveita `normalize_whatsapp_number` (já usado no envio real) em vez
  de reimplementar a validação, para garantir que o relatório reflita
  exatamente o que vai (ou não vai) funcionar no envio de fato.
- Endpoint somente leitura, sem side-effects — pode ser chamado quantas
  vezes o usuário quiser sem risco.
