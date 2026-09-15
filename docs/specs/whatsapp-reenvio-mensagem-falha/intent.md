# Intent - whatsapp-reenvio-mensagem-falha

## Problema

Quando o envio de uma mensagem de texto livre falha (erro da Graph API,
rede, etc.), a mensagem fica marcada como `failed` na conversa, mas o
único jeito de tentar de novo hoje é reescrever o texto do zero no
composer — perde-se o conteúdo original e o atendente precisa lembrar o
que tinha escrito.

## Objetivo

Um botão "Reenviar" na própria mensagem com falha, que reenvia o mesmo
texto sem precisar redigitar.

## Escopo

- Botão "Reenviar" no rodapé de qualquer mensagem `from_me: true` com
  `status: "failed"`.
- Reenvio reaproveita o endpoint já existente `POST
  /conversations/:id/messages` (mesmo usado pelo composer), criando uma
  **nova** mensagem com o mesmo `body`/`type` — não sobrescreve nem
  duplica a mensagem original, que continua visível no histórico marcada
  como `failed` (rastro do que aconteceu).

## Fora de escopo

- Reenvio automático (retry em background) — é sempre uma ação explícita
  do atendente.
- Editar o texto antes de reenviar — se precisar mudar o texto, o
  atendente já pode copiar e colar no composer manualmente.

## Riscos e decisões

- Reenviar cria uma mensagem nova em vez de "consertar" a antiga: mais
  simples (reaproveita o fluxo de envio já existente e testado, mesma
  validação de janela de 24h) e mantém o histórico completo e honesto
  (a tentativa que falhou não desaparece).
- Sujeito à mesma regra de janela de atendimento (24h) do envio normal —
  se a janela já fechou, o reenvio falha com o mesmo erro 409 já tratado
  pelo composer.
