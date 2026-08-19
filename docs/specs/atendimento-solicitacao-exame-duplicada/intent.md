# Intent - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19
Status: implementacao

## Problema

Uma solicitacao de exame pode reaparecer depois de removida quando o usuario a exclui enquanto o primeiro autosave ainda esta criando o registro. O item desaparece da tela sem carregar `id`, mas o POST termina no servidor; como a exclusao nao foi enviada de forma explicita, o registro permanece e e listado no PDF. Cliques repetidos no catalogo tambem podem criar itens iguais antes de a tela receber o primeiro `id`.

## Objetivo

Manter uma unica selecao de exame de catalogo na tela, preservar a intencao de exclusao ocorrida durante o autosave e impedir que payloads atrasados recriem exames removidos.

## Nao objetivos

- Apagar automaticamente exames legados que tenham laudo, anexo ou liberacao no portal.
- Alterar a regra clinica que protege registros vinculados de exclusao.
