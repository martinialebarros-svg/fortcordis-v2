# Plan - deploy-backup-rotation

Data: 2026-08-03
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (script de deploy): adicionar variaveis de configuracao e a funcao
  `prune_runtime_backups()`, e o call site antes da criacao do backup do
  deploy atual.
- Fase 4 (integracao/observabilidade): validar sintaxe (`bash -n`) e testar a
  funcao isoladamente em diretorios sinteticos (idade e quantidade).

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Adicionar `RUNTIME_BACKUP_RETENTION_DAYS` e
  `RUNTIME_BACKUP_MAX_ITEMS` (com defaults `30` e `200`) logo apos a
  declaracao de `RUNTIME_BACKUP_DIR`, com comentario explicando a causa raiz
  do incidente.
- [x] T3.2 Implementar `prune_runtime_backups()` logo apos
  `backup_runtime_file()`: poda por idade via `find -mtime "+N"`, depois poda
  por quantidade via `find -printf '%T@ %p\n' | sort -n` removendo os mais
  antigos ate atingir o limite.
- [x] T3.3 Chamar `prune_runtime_backups` logo apos `mkdir -p
  "$RUNTIME_BACKUP_DIR"`, antes de `STAMP="$(date +%Y%m%d_%H%M%S)"`.
- [x] T3.4 Documentar as duas novas variaveis no comentario de uso no topo do
  script (bloco de variaveis de ambiente suportadas).
- Criterio de conclusao: `bash -n scripts/deploy_prod_vps.sh` aprovado.
- Risco: baixo - funcao nova, isolada, chamada antes de qualquer efeito
  colateral do deploy atual.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `bash -n scripts/deploy_prod_vps.sh` aprovado.
- [x] T4.2 Teste isolado da poda por quantidade: diretorio sintetico com 250
  itens (sem diferenciacao de idade), `RUNTIME_BACKUP_MAX_ITEMS=200` ->
  confirmado que reduz para exatamente 200, removendo os 50 criados primeiro
  (mais antigos por mtime).
- [x] T4.3 Teste isolado da poda por idade: diretorio sintetico com 30 itens
  com mtime forcado para ~40 dias atras (via `touch -t`, sintaxe portavel) e
  10 itens recentes, `RUNTIME_BACKUP_RETENTION_DAYS=30` -> confirmado que
  remove exatamente os 30 antigos e preserva os 10 recentes.
- Criterio de conclusao: `verify.md` com evidencia dos dois testes.
- Risco residual: nenhum conhecido - a logica core (`find -mtime`) ja tinha
  sido validada tambem contra a VPS real de producao durante o diagnostico do
  incidente original (encontrou corretamente 1194 itens com mais de 30 dias).
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes manuais isolados (funcao extraida via `sed` e executada num
  diretorio temporario sintetico), cobrindo os dois criterios de poda
  separadamente.
- Sem teste automatizado em `pytest`/CI - o script roda fora do processo de
  aplicacao (deploy operacional via SSH), sem harness de teste dedicado no
  repositorio.

## 4) Dependencias e bloqueios

- Nenhum.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
