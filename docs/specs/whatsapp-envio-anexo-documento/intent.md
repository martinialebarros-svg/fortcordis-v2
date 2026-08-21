# Intent - whatsapp-envio-anexo-documento

## Problema

O composer da Central de Atendimento WhatsApp (`whatsapp-stage/page.tsx`)
só permite responder com texto livre ou com um modelo aprovado
(`whatsapp-approved-template-catalog`). Não existe jeito de anexar um
arquivo qualquer (PDF de exame, orçamento em Word/Excel etc.) direto na
conversa — o único caminho para mandar um PDF hoje é o fluxo formal de
recibo (`whatsapp-financeiro-cobranca-recibo-pdf`), amarrado a uma ordem
de serviço e a um template aprovado pela Meta, não a uma resposta livre
dentro da janela de 24h.

## Objetivo

Um botão de anexo no composer, análogo ao de qualquer app de chat: o
atendente escolhe um arquivo do computador (PDF, Word, Excel, PowerPoint,
CSV ou texto, até 8 MB) e o WhatsApp Cloud API entrega como mensagem de
documento na conversa, com ou sem legenda.

## Não objetivos

- Anexar imagem/áudio/vídeo como mídia inline (tipos `image`/`audio`/
  `video` da Cloud API) — o pedido original foi "anexar um PDF", e um
  anexo de documento cobre isso e os outros formatos de escritório sem
  precisar de UI de preview de mídia (câmera, player, etc.).
- Persistir o arquivo no nosso storage para permitir reenvio automático
  depois de uma falha — como em `whatsapp-acesso-midia-recebida`, o
  binário nunca fica guardado no nosso lado, só passa pela Graph API.
- Alterar o fluxo formal de recibo/financeiro (`whatsapp-financeiro-
  cobranca-recibo-pdf`) — esse continua sendo o caminho para documentos
  ligados a uma ordem de serviço, com idempotência e template aprovado;
  este anexo é para o caso genérico de resposta livre.

## Contexto e restrições

- Restrições técnicas: só é possível enviar documento livre (fora de
  template) enquanto a janela de atendimento de 24h estiver aberta —
  mesma regra que já vale para texto livre.
- Restrições de prazo: nenhuma.
- Restrições regulatório/operacional: a Cloud API não permite reenviar o
  mesmo arquivo sem re-upload; um anexo que falhar precisa ser
  re-selecionado pelo atendente (ver "Riscos").

## Impacto esperado

- Usuários impactados: atendentes da Central de Atendimento WhatsApp.
- Módulos impactados: `whatsapp-stage-backend` (rota de envio de
  mensagem, serviço da Graph API) e `frontend/app/whatsapp-stage`
  (composer da conversa).
- Risco de regressão: a rota `POST /conversations/:id/messages` e a
  função `uploadWhatsAppPdfWithRetry` (usada pelo fluxo de recibo
  financeiro) foram tocadas para reaproveitar um upload de mídia
  genérico — risco de regressão nesse fluxo se a validação de PDF for
  afetada pelo refactor.

## Riscos iniciais

- Risco 1: reaproveitar `uploadWhatsAppPdfWithRetry` num helper genérico
  poderia relaxar sem querer a validação de magic bytes `%PDF` do fluxo
  de recibo financeiro. Mitigação: o refactor mantém a validação de PDF
  como checagem específica antes de delegar ao helper genérico, e um
  teste de regressão cobre isso explicitamente.
- Risco 2: um anexo que falha ao enviar (erro da Graph API) não pode ser
  reenviado pelo botão "Reenviar" já existente, porque esse botão só
  reconstrói a requisição a partir do texto salvo (não guardamos o
  binário). Mitigação: o botão "Reenviar" passou a não aparecer para
  mensagens `type: "document"`, evitando uma segunda falha silenciosa e
  confusa (ver `whatsapp-reenvio-mensagem-falha/spec.md`, RF-002
  atualizado).

## Perguntas abertas

- Vale a pena, no futuro, permitir anexar imagem/vídeo inline (não só
  como "documento" genérico)? Fora de escopo por agora.

## Definition of Ready (gate para spec)

- [x] Problema e objetivo estão claros.
- [x] Escopo e não escopo estão explícitos.
- [x] Restrições estão registradas.
- [x] Riscos iniciais estão mapeados.
