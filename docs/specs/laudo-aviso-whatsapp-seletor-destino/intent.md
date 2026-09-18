# Intent - laudo-aviso-whatsapp-seletor-destino

## Problema

O botão "Avisar WhatsApp" dispara para **todos** os destinos liberados do laudo
de uma vez: a clínica e cada veterinário parceiro
([laudo-aviso-whatsapp-parceiro](../laudo-aviso-whatsapp-parceiro/intent.md) e a
difusão por vínculo de
[portal-veterinario-multiplas-clinicas](../portal-veterinario-multiplas-clinicas/intent.md)).
Não existe avisar um e deixar o outro.

Isso apareceu na prática, em produção, no laudo 1106 (registrado no
[verify.md](../laudo-aviso-whatsapp-parceiro/verify.md) daquela spec): a clínica
já tinha sido avisada e faltava a veterinária parceira, que só virou destino
depois. Para alcançá-la foi preciso clicar de novo — e a clínica recebeu a
mesma mensagem pela terceira vez no mesmo dia.

O reenvio não é acidente de implementação, é o desenho: cada clique gera uma
`idempotency_key` nova, então o provedor aceita a mensagem repetida.

## Objetivo

Escolher quem recebe antes de enviar, com o padrão certo já marcado: **quem
ainda não recebeu**.

## Escopo

- Uma janela de seleção no lugar do `confirm()`, nas duas telas de laudos
  (Central de laudos e visualização), listando a clínica e cada veterinário
  liberado, com o resultado do último envio de cada um.
- Pré-seleção de quem ainda não foi avisado com sucesso; quem já recebeu entra
  desmarcado, e marcar de novo é reenvio consciente.
- O endpoint aceita a lista de destinos escolhidos e envia só para eles.
- Resultado do último envio guardado **por destino**, não só em resumo — é o que
  permite saber quem já recebeu quando o laudo tem vários veterinários.

## Fora de escopo

- Histórico completo de envios por destino. Continua valendo "o último
  resultado", como nas colunas atuais.
- Escolher o número dentro de um destino (a clínica pode ter vários números
  cadastrados; o aviso continua indo para o primeiro).
- Reenvio automático de quem falhou.
- Mudar o que acontece na liberação no portal — o seletor governa só o aviso
  por WhatsApp.

## Riscos e decisões

- **Guardar por destino exige onde guardar.** As colunas de hoje são um resumo:
  `whatsapp_liberacao_*` é da clínica e `whatsapp_parceiro_*` virou "algum
  veterinário falhou / todos enviados" depois da difusão. Com vários
  veterinários, o resumo não responde "quem já recebeu". Entra uma coluna JSON
  `whatsapp_envios` com o último resultado por chave de destino
  (`clinica`, `veterinario:<id>`), e as colunas atuais seguem intactas para as
  badges e para quem já consome a API.
- **Compatibilidade do endpoint.** `destinos` é opcional: sem ele, o
  comportamento é o de hoje (todos os elegíveis). Só a interface nova passa a
  mandar a lista.
- **Pré-seleção não é trava.** Quem já recebeu aparece desmarcado, com a data do
  envio ao lado, e pode ser marcado de novo — reenvio continua possível, só
  deixa de ser o caminho automático.
- **Destino escolhido que não é elegível é erro, não silêncio.** Pedir envio
  para quem não está liberado no portal ou não tem WhatsApp responde 422, em vez
  de ignorar em silêncio e deixar a tela achando que avisou.
