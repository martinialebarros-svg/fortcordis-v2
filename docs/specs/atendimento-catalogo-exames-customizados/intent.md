# Intent - atendimento-catalogo-exames-customizados

Data: 2026-08-26
Status: implementacao

## Problema

O modal de criacao e edicao de paineis permite selecionar somente exames que
ja existem no catalogo. A interface nao oferece cadastro, edicao ou exclusao de
itens do catalogo; o botao "Exame manual" cria uma solicitacao isolada e nao
torna esse exame reutilizavel em paineis futuros.

## Objetivo

Permitir que o usuario gerencie exames customizados dentro do proprio modal de
paineis, com atualizacao imediata e ordenada da lista, sem permitir alteracoes
nos exames padrao mantidos pela aplicacao.

## Nao objetivos

- Alterar ou excluir exames padrao carregados pelo seed institucional.
- Apagar solicitacoes clinicas historicas ao desativar um item do catalogo.
- Transformar automaticamente exames manuais ja digitados em itens de catalogo.
