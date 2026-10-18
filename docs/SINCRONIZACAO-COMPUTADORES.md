# Alternar entre Samsung e MacBook

O GitHub transporta o codigo entre os computadores. Use **a mesma branch de
trabalho** nos dois. Alteracoes so chegam ao outro computador depois do envio.

## Instalacao inicial

Requisitos: Git autenticado no GitHub e Node.js 18 ou superior. Node.js ja faz
parte do ambiente de desenvolvimento do frontend. Nao ha pacotes adicionais.

No Samsung, `git sync` ja foi instalado no repositorio desta tarefa.

No MacBook, abra o terminal na pasta do FortCordis. Depois de conferir que nao
ha trabalho pendente com `git status`, execute uma vez:

```sh
git fetch origin
git switch codex/sincronizacao-computadores
node scripts/sync-project.mjs instalar
```

Se houver alteracoes pendentes no MacBook, registre e envie esse trabalho na
branch correspondente antes de trocar. O comando nao descarta essas alteracoes.

O alias e instalado apenas neste repositorio de cada computador. Se voce usa
outros clones independentes, instale em cada clone. A instalacao guarda uma copia
da ferramenta dentro do diretorio Git local, para continuar funcionando mesmo
ao abrir branches antigas que ainda nao contem o script. Para atualizar a
ferramenta no futuro, execute novamente a instalacao a partir da versao atualizada
de `scripts/sync-project.mjs`.

## Rotina diaria (os mesmos comandos no Windows e no Mac)

Ao comecar, ja na branch da tarefa:

```sh
git sync
```

Ao terminar, salve os arquivos no editor e execute:

```sh
git sync enviar "Descricao do que foi feito"
```

Esse comando registra **todas as alteracoes nao ignoradas** da branch atual e
envia ao GitHub. Use `git status` antes se quiser conferir os arquivos envolvidos.
Para enviar apenas commits ja registrados, use `git sync enviar`, sem mensagem.

Ao passar para outro computador ou continuar outra tarefa, indique a branch
impressa ao fim do envio:

```sh
git sync receber codex/nome-da-tarefa
```

O comando abre a branch local, ou cria uma copia acompanhando a branch no GitHub,
e recebe seus commits. Para uma tarefa nova, partindo do codigo atualizado:

```sh
git switch -c codex/nome-da-tarefa
```

`main` e `stage` podem receber atualizacoes. O envio por este comando e bloqueado
nessas branches porque elas acionam deploy; alteracoes entram pelo fluxo de PR
do projeto. Publicar uma branch de trabalho preserva o trabalho entre maquinas
sem publicar uma versao do sistema.

## Quando o comando para

- **Alteracoes locais ao receber:** salve e envie o trabalho na branch correta
  antes de receber ou trocar de branch.
- **Remoto avancou e ha alteracoes locais:** preserve as alteracoes em um commit
  com Git e revise a atualizacao. A ferramenta interrompe antes de criar commits.
- **Commits diferentes nos dois lados:** revise o historico com ajuda antes de
  continuar. A ferramenta nao faz merge de historicos, rebase, stash ou force push.
- **Operacao Git pendente, HEAD destacado ou alteracoes ocultadas no indice:**
  resolva o estado indicado na mensagem antes de sincronizar.
- **Falha de rede ou autenticacao:** os arquivos e commits locais continuam no
  computador. Resolva o acesso e repita o comando.

## Arquivos e ambiente de cada computador

O comando respeita `.gitignore`. `.env`, bancos locais `.db`, uploads ignorados,
dependencias instaladas e caches permanecem em cada computador. Ele tambem
recusa sobrescrever um arquivo ignorado caso o remoto passe a versionar o mesmo
caminho. A sincronizacao e de codigo, nao de dados de pacientes ou configuracoes.

Quando houver mudancas nas dependencias, atualize o ambiente de desenvolvimento
correspondente (`npm ci` no frontend e as dependencias Python no ambiente virtual
local). Isso nao faz parte de `git sync`, que tambem nao inicia servidores,
aplica migracoes ou executa deploy.

Para remover o atalho local:

```sh
git config --local --unset alias.sync
```
