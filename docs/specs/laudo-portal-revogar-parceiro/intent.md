# Intent - laudo-portal-revogar-parceiro

## Problema

Liberar um laudo no portal para um veterinário parceiro é um caminho de mão
única. `POST /laudos/{id}/portal/liberar` cria a `PortalPartnerReleaseTarget`
que dá acesso, e nada no sistema tira esse acesso depois: não há rota para
revogar, nem tela que ofereça isso.

O `POST /exames/{id}/portal/revogar`, que existe, não serve — ele mexe no
status do exame e não toca nas liberações de parceiro. A única coisa que hoje
remove a linha é **apagar o laudo inteiro** (`deletar_laudo`), que é grande
demais para "esse veterinário não deveria mais ver este laudo".

Isso apareceu na prática ao desfazer uma fixture de verificação em stage: o
vínculo do parceiro com o laudo saiu pela API, mas o acesso ao portal ficou. Em
produção o mesmo vale para erro de vínculo — laudo liberado para o parceiro
errado continua visível para ele, sem caminho de volta.

## Objetivo

Tirar o acesso de um veterinário parceiro a um laudo específico, sem afetar a
clínica nem os outros veterinários.

## Escopo

- `POST /laudos/{laudo_id}/portal/veterinarios/{partner_id}/revogar`: marca
  `revoked_at` na liberação ativa daquele parceiro para o exame do laudo.
- Auditoria do que foi revogado, como já acontece na liberação.
- A resposta devolve o estado de liberação do laudo, para a tela atualizar sem
  recarregar.

## Fora de escopo

- Tela. Este ciclo entrega a rota; a lista de "liberado para" com o botão de
  revogar em `laudos/[id]` fica para o próximo, junto da verificação visual.
- Revogar a liberação da clínica (quem faz isso é o `/exames/{id}/portal/revogar`).
- Apagar o histórico de avisos por WhatsApp já enviados ao parceiro: o registro
  do que saiu continua valendo, mesmo depois de tirar o acesso.

## Riscos e decisões

- **Revogar não é apagar.** A linha continua na tabela com `revoked_at`
  preenchido, e é assim que a re-liberação funciona: o
  `_upsert_portal_partner_release_target` reativa a mesma linha zerando o
  `revoked_at`. Apagar a linha perderia quem liberou e quando.
- **Um clique em "No portal" devolve o acesso** — inclusive para quem entra por
  difusão de clínica. Revogar vale para o estado atual, não é uma trava contra
  liberações futuras; uma trava seria outro conceito (bloqueio por parceiro).
- **A rota fica sob o laudo, não sob o parceiro**, porque é assim que o resto do
  fluxo está organizado (`/laudos/{id}/portal/liberar`,
  `/laudos/{id}/portal/whatsapp`) e é do laudo que a tela parte.
