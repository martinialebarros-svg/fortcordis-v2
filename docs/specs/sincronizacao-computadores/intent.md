# Sincronizacao entre Samsung e MacBook

## Problema e objetivo

A copia Samsung permaneceu em abril enquanto o GitHub recebeu trabalho ate outubro.
O usuario autorizou atualizar essa copia e preparar um comando simples para alternar
entre Windows e macOS usando o mesmo repositorio e a mesma branch.

## Escopo aprovado

- Atualizar `stage` e `main` locais somente por avanco de historico.
- Instalar `git sync` localmente e versionar sua implementacao para o MacBook.
- Receber atualizacoes e enviar trabalho com uma acao explicita.
- Preservar configuracoes, bancos e uploads locais.

## Restricoes e riscos

- Nao executar deploy, migracoes ou sincronizar dados clinicos.
- Nao sobrescrever trabalho, aplicar stash, rebase, merge de historicos ou force push.
- Bloquear envio para `main` e `stage`, que acionam deploy.
- Parar em divergencia, operacao Git pendente ou alteracoes ocultadas no indice.
- O MacBook precisa executar a instalacao uma vez; nao esta acessivel nesta sessao.

## Aprovacao

Pedido do usuario em 2026-10-17: atualizar o projeto no Samsung e preparar um comando
simples para sincronizar ao alternar entre ele e o MacBook.
