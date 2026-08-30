# Intent - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19 (revisado em 2026-08-26)
Status: implementacao

## Problema

Uma solicitacao de exame pode reaparecer depois de removida quando o usuario a exclui enquanto o primeiro autosave ainda esta criando o registro. O item desaparece da tela sem carregar `id`, mas o POST termina no servidor; como a exclusao nao foi enviada de forma explicita, o registro permanece e e listado no PDF. Cliques repetidos no catalogo tambem podem criar itens iguais antes de a tela receber o primeiro `id`.

Ha uma segunda variante da mesma corrida: o autosave envia um texto parcial
(`Rela`) e o usuario continua digitando antes da resposta. Como o texto atual ja
nao tem a mesma assinatura do texto enviado, o frontend nao incorpora o `id`
criado. O save seguinte insere o texto completo como outro exame e deixa o
fragmento no banco/PDF. A chegada do `id` tambem troca a chave React do card,
podendo remontar o input e interromper foco/cursor.

## Objetivo

Manter uma unica selecao de exame de catalogo na tela, preservar a identidade da
mesma linha enquanto o usuario continua digitando, conservar a intencao de
exclusao ocorrida durante o autosave e impedir que payloads atrasados recriem
exames removidos.

## Nao objetivos

- Apagar automaticamente exames legados que tenham laudo, anexo ou liberacao no portal.
- Alterar a regra clinica que protege registros vinculados de exclusao.
