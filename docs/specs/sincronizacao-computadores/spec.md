# Especificacao

## Requisitos

- RF-001: `node scripts/sync-project.mjs instalar` registra o alias local `git sync`.
  Uma copia no diretorio Git local mantem o comando disponivel mesmo em branches
  antigas. A implementacao usa apenas Node.js e Git, com os mesmos comandos nos
  dois sistemas.
- RF-002: `git sync` ou `git sync receber [branch]` busca `origin` e atualiza apenas
  por fast-forward. Uma branch indicada pode ser aberta a partir de `origin`.
- RF-003: `git sync enviar "mensagem"` registra todas as alteracoes nao ignoradas e
  envia a branch atual para a branch de mesmo nome em `origin`. Sem mensagem, so
  pode enviar commits ja existentes em uma arvore limpa.
- RF-004: envios para `main` e `stage` sao recusados antes de registrar alteracoes.
- RF-005: divergencia ou branch desatualizada com trabalho pendente interrompe o
  envio antes de alterar o indice. Receber exige arvore limpa e nenhum commit local
  ausente do remoto. Nao ha stash, rebase, merge commit, reset ou force push.
- RF-006: bancos, configuracoes e uploads ignorados permanecem locais. Receber ou
  trocar de branch recusa sobrescrever arquivos ignorados que passaram a ser
  versionados no remoto.
- RF-007: HEAD destacado, operacoes Git pendentes e flags que ocultam alteracoes
  no indice impedem sincronizacao com orientacao explicita.
- RF-008: a documentacao explica instalacao inicial no MacBook, uso diario, troca
  de branch e tratamento de trabalho nao enviado.

## Criterios de aceitacao

- CA-001: o alias funciona a partir de subpastas e caminhos com espacos.
- CA-002: duas copias de teste enviam e recebem o mesmo commit pelo remoto de teste.
- CA-003: alteracoes locais, divergencia e flags ocultas nao sao descartadas ou
  commitadas implicitamente; mensagens com caracteres especiais sao preservadas.
- CA-004: branches de deploy e operacoes incompletas bloqueiam o envio.
- CA-005: um arquivo ignorado e preservado, inclusive se um commit remoto passar
  a versionar um arquivo com o mesmo nome.
- CA-006: o Samsung tem `stage` e `main` iguais aos respectivos remotos; o comando
  fica disponivel em uma branch publicada para instalacao no MacBook.
