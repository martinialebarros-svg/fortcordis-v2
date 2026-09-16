# Intent - laudo-aviso-whatsapp-parceiro

## Problema

O botão "Avisar WhatsApp" (`POST /laudos/{id}/portal/whatsapp`) manda o aviso
de laudo disponível para **um único número, sempre da clínica**: o primeiro de
`clinicas.whatsapps`, ou `clinicas.telefone` se a lista estiver vazia
(`_registered_clinic_whatsapp_numbers`). O `veterinario_parceiro_id` do laudo
nem é lido no endpoint.

Quem encaminhou o caso, porém, muitas vezes é o veterinário parceiro — e é ele
quem espera o resultado. Hoje ele só descobre que o laudo saiu por e-mail, e
apenas no momento da liberação no portal (`notify_partner_report_released`,
disparado dentro de `POST /laudos/{id}/portal/liberar`). E-mail de parceiro
autônomo é canal lento; o aviso útil é o WhatsApp, que a clínica já recebe.

Também existe um caso em que ninguém recebe WhatsApp nenhum: laudo vinculado só
a veterinário parceiro, sem clínica. O endpoint responde 409 ("O laudo nao
possui clinica parceira vinculada.") e o botão nem aparece na interface.

## Objetivo

Um clique em "Avisar WhatsApp" avisa **todos os destinos externos do laudo que
já estão liberados no portal**: a clínica parceira e o veterinário parceiro.

## Escopo

- Envio do modelo aprovado `portalReportAvailable` também para o número do
  veterinário parceiro (`portal_partner_profiles.whatsapp`, com
  `portal_partner_profiles.telefone` como fallback).
- O parceiro só é avisado se o laudo estiver **liberado para ele no portal**
  (`PortalPartnerReleaseTarget` ativo para o exame, mesma checagem de
  `_portal_veterinario_liberado`). O texto do modelo manda consultar o
  resultado no portal; avisar quem ainda não tem acesso liberado geraria uma
  mensagem que não leva a lugar nenhum.
- Laudo só com parceiro (sem clínica) passa a poder ser avisado.
- Resultado por destino persistido e visível: a clínica continua nas colunas
  `whatsapp_liberacao_*`; o parceiro ganha `whatsapp_parceiro_*`.

## Fora de escopo

- Escolher o número do parceiro na hora do envio. A clínica tem o parâmetro
  `destination` (validado contra os números dela) porque pode ter vários;
  o parceiro tem um número só no cadastro, e nenhuma tela oferece a escolha.
- Avisar o tutor. O modelo aprovado manda consultar o portal, e tutor não tem
  portal — seria outro modelo, outra aprovação na Meta.
- Modelo novo/específico para o parceiro. O `portalReportAvailable` já tem o
  primeiro parâmetro rotulado "Clínica ou destinatário"
  (`templateCatalogController.ts`), então mandar o nome do parceiro ali está
  dentro do uso aprovado.
- Histórico de tentativas de envio. Continua valendo o "último resultado" por
  destino, como em
  [laudo-whatsapp-liberacao-status](../laudo-whatsapp-liberacao-status/intent.md).

## Riscos e decisões

- **Um clique, duas mensagens.** O `idempotency_key` que o frontend gera é um
  só; o serviço de WhatsApp rejeita a mesma chave com conteúdo diferente
  (`idempotency_key was already used with different content`). Por isso a
  chave da clínica continua sendo a recebida (idempotência preservada para quem
  já usava o endpoint) e a do parceiro é derivada: `<chave>-vet`, truncada em
  128 caracteres, que é o limite do `cleanText` do serviço.
- **Falha parcial não vira erro global.** Se a clínica foi avisada e o parceiro
  falhou, responder 502 convidaria a reclicar — e o reclique gera chave nova,
  duplicando a mensagem para a clínica. Então: falha só do parceiro responde
  200 com o resultado por destino, e a interface avisa em toast âmbar. Falha da
  clínica continua 502, como antes.
- **Contrato de erro preservado.** Os 409/422/502 já existentes continuam com
  os mesmos códigos e mensagens nos casos em que já ocorriam; os casos novos
  (laudo só com parceiro, parceiro sem número cadastrado) não reaproveitam
  essas mensagens com sentido diferente.
