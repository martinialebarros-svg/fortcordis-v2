# Intent - laudo-whatsapp-liberacao-status

## Problema

Na tela "Central de laudos", o botão de WhatsApp (`avisarLaudoPorWhatsApp`,
`POST /laudos/{id}/portal/whatsapp`) dispara o aviso de liberação de laudo
para a clínica, mas o único feedback hoje é um `alert()` nativo no momento
do clique. Nada fica registrado no backend, e nada aparece na lista depois
que a página recarrega. Com quase 900 laudos na base, não dá pra saber,
olhando a lista, se o aviso de um laudo específico foi enviado com sucesso
ou falhou — só clicando de novo (e arriscando reenvio duplicado, mesmo com
idempotency key).

## Objetivo

Dois tipos de feedback visual, sem alert():
1. Um toast temporário no momento do clique (sucesso ou erro).
2. Uma badge persistente na linha do laudo, mostrando o resultado da
   última tentativa de envio, que sobrevive a reload da página.

## Escopo

- Persistir em `laudos` o resultado da última tentativa de aviso por
  WhatsApp: `whatsapp_liberacao_status` ("enviado" | "falhou"),
  `whatsapp_liberacao_em`, `whatsapp_liberacao_erro`.
- O status refletido é o de **aceitação do envio pela API** (a chamada
  síncrona a `send_approved_utility_template` teve sucesso ou levantou
  `WhatsAppTemplateDeliveryError`) — não confirmação de entrega/leitura.
- Badge na linha da lista + toast substituindo os `alert()` existentes no
  handler `avisarLaudoPorWhatsApp`.

## Fora de escopo

- Status real de entrega/leitura da mensagem (delivered/read via webhook da
  Meta). Esse dado vive isolado no serviço `whatsapp-stage-backend`
  (tabelas `approved_template_messages` / `messages` /
  `message_status_events`), que hoje não expõe nenhum endpoint de consulta
  por `subject_id`. Trazer isso exigiria um endpoint novo lá e integração
  assíncrona no backend principal — escopo bem maior, adiado.
- Reenvio automático em caso de falha — o botão de WhatsApp continua sendo
  uma ação manual e explícita.

## Riscos e decisões

- Colunas novas na própria tabela `laudos` (não uma tabela separada): a
  relação é 1:1 com o laudo (um único "último envio" por laudo), mesmo
  padrão já usado em `exames.visualizado_portal_em`
  (`backend/migrations/versions/20260815_67_exame_visualizado_portal.py`).
  Uma tabela de histórico completo de tentativas seria mais correta a
  longo prazo, mas não foi pedida — o pedido é saber "foi ou não" a última
  vez.
- Migração idempotente (`ALTER TABLE ... ADD COLUMN` com checagem via
  `inspector.get_columns`), seguindo o padrão já estabelecido no projeto
  para colunas nullable adicionadas a tabelas existentes.
- No frontend, o estado da badge é atualizado otimisticamente a partir da
  própria resposta do clique (sucesso/erro), sem recarregar a lista — o
  timestamp local (`new Date().toISOString()`) pode divergir em
  milissegundos do timestamp persistido no backend, o que é aceitável
  porque o backend é a fonte de verdade em qualquer reload subsequente.
