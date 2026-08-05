# Intent - deploy-backup-rotation

Data: 2026-08-03
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

Em 2026-08-03 um deploy de producao falhou por falta de espaco em disco
(`ENOSPC` durante `next build`), e o rollback automatico tambem falhou pelo
mesmo motivo (`index.lock` sem espaco para gravar), deixando o `.next/BUILD_ID`
ausente ate a correcao manual. Diagnostico via SSH na VPS de producao mostrou
`~/fortcordis-runtime-backups` com 13G / 2004 itens acumulados desde
fevereiro/2026, sem nenhuma rotacao.

Causa raiz: `scripts/deploy_prod_vps.sh` (compartilhado por stage e producao,
que rodam na mesma VPS com o mesmo `$HOME`) cria um snapshot em
`RUNTIME_BACKUP_DIR` a cada deploy (`backup_runtime_file`) e nunca remove
nada - o diretorio cresce sem limite a cada deploy, de ambos os ambientes.

## 2) Objetivo

Fazer o script de deploy podar automaticamente `RUNTIME_BACKUP_DIR` antes de
cada novo backup, por dois criterios combinados: idade maxima (dias) e
quantidade maxima de itens - para que o diretorio pare de crescer sem limite
mesmo se a frequencia de deploy aumentar.

## 3) Nao objetivos

- Mudar onde os backups sao gravados, ou o formato/conteudo de cada backup.
- Adicionar rotacao para o cache do `npm` (`~/.npm`) ou outros consumidores de
  disco identificados no mesmo incidente - tratados manualmente durante a
  resposta ao incidente, fora de escopo aqui.
- Alterar o `deploy_backup_restore_drill.py` (o drill cria seus proprios
  arquivos no mesmo diretorio, mas a poda aqui e generica por item/mtime e
  cobre esses arquivos tambem sem precisar tocar o drill).

## 4) Contexto e restricoes

- `scripts/deploy_stage_vps.sh` e um wrapper fino que exporta variaveis de
  ambiente e chama `scripts/deploy_prod_vps.sh` - corrigir so este ultimo
  cobre os dois ambientes (stage e producao) automaticamente.
- A poda precisa rodar ANTES da criacao do backup do deploy atual (para nao
  contar/podar o item que acabou de ser criado por engano) e sem depender de
  ferramentas alem de `find`/`sort`/`rm` (ja disponiveis no shell POSIX da
  VPS).
- Limites devem ser configuraveis via variavel de ambiente (mesmo padrao das
  demais flags do script), com defaults sensatos: 30 dias de retencao e 200
  itens no maximo.

## 5) Impacto esperado

- Usuarios impactados: nenhum usuario final - mudanca e puramente
  operacional/infraestrutura, roda durante o deploy.
- Modulos impactados: `scripts/deploy_prod_vps.sh` (e, por consequencia,
  `scripts/deploy_stage_vps.sh`).
- Risco de regressao: baixo - a poda so remove itens acima dos limites
  configurados, sem alterar o fluxo de backup/restore em si.

## 6) Riscos iniciais

- Risco 1: podar um backup que ainda seria necessario para um rollback
  manual. Mitigado pelos defaults generosos (30 dias / 200 itens, muito acima
  do necessario para qualquer rollback realista) e por ambos os limites
  serem configuraveis via variavel de ambiente caso precisem de ajuste.
- Risco 2: `find -printf` (usado na poda por quantidade) e uma extensao GNU,
  nao disponivel no `find` do BSD/macOS - sem impacto real, pois o script so
  roda na VPS de producao/stage (Linux/GNU coreutils), nunca localmente em
  macOS.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
