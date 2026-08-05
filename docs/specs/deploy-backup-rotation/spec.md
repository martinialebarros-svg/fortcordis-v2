# Spec - deploy-backup-rotation

Data: 2026-08-03
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

Adicionar a funcao `prune_runtime_backups()` em `scripts/deploy_prod_vps.sh`,
chamada logo apos `mkdir -p "$RUNTIME_BACKUP_DIR"` e antes de qualquer novo
backup ser criado no deploy atual. A funcao aplica dois criterios de poda,
nesta ordem:

1. Por idade: remove itens de primeiro nivel em `RUNTIME_BACKUP_DIR` com mtime
   mais antigo que `RUNTIME_BACKUP_RETENTION_DAYS` dias.
2. Por quantidade: se, apos a poda por idade, ainda houver mais itens que
   `RUNTIME_BACKUP_MAX_ITEMS`, remove os itens mais antigos (por mtime) ate
   atingir o limite.

## 2) Requisitos funcionais (RF)

- RF-001: novas variaveis `RUNTIME_BACKUP_RETENTION_DAYS` (default `30`) e
  `RUNTIME_BACKUP_MAX_ITEMS` (default `200`), configuraveis via variavel de
  ambiente, seguindo o padrao `"${VAR:-default}"` ja usado no restante do
  script.
- RF-002: `prune_runtime_backups()` nao falha (nem interrompe o deploy) se
  `RUNTIME_BACKUP_DIR` ainda nao existir - retorna cedo nesse caso.
- RF-003: a poda por idade usa `find "$RUNTIME_BACKUP_DIR" -mindepth 1
  -maxdepth 1 -mtime "+${RUNTIME_BACKUP_RETENTION_DAYS}"` (primeiro nivel
  apenas, sem descer em subdiretorios).
- RF-004: a poda por quantidade ordena os itens remanescentes por mtime
  (`find -printf '%T@ %p\n' | sort -n`) e remove os mais antigos, um a um, ate
  que o total fique igual a `RUNTIME_BACKUP_MAX_ITEMS`.
- RF-005: cada poda (por idade e por quantidade) emite uma linha de log
  (`log "Pruned N runtime backup item(s)..."`) somente quando `N > 0` -
  silencioso quando nao ha nada para podar.
- RF-006: a chamada a `prune_runtime_backups` acontece apos `mkdir -p
  "$RUNTIME_BACKUP_DIR"` e antes de `STAMP="$(date +%Y%m%d_%H%M%S)"`, ou seja,
  antes de qualquer arquivo do deploy atual ser criado no diretorio.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): usa apenas utilitarios GNU coreutils/findutils
  ja disponiveis na VPS (mesma familia de comandos que o resto do script);
  nao precisa funcionar em BSD/macOS pois o script so roda remotamente via
  SSH na VPS de deploy.
- NFR-002 (idempotencia): rodar a funcao repetidas vezes sem novos itens no
  diretorio nao tem efeito colateral (nada a podar, nenhum log emitido).
- NFR-003 (seguranca): `rm -rf --` usa `--` para nao interpretar nomes de
  arquivo iniciados por `-` como flags.

## 4) Contratos tecnicos

Nenhum contrato de API ou schema de banco - mudanca isolada em script de
shell operacional (`scripts/deploy_prod_vps.sh`), sem migration.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - defaults preservam o comportamento de
  retencao pretendido (30 dias / 200 itens); ambientes que definirem as novas
  variaveis explicitamente podem ajustar os limites sem alterar o script.
- Rollback: reverter o commit (a poda deixa de rodar, backups voltam a se
  acumular sem limite - mesmo estado anterior ao incidente).

## 6) Criterios de aceitacao (CA)

- CA-001: `bash -n scripts/deploy_prod_vps.sh` aprovado (sintaxe valida).
- CA-002: em um diretorio de teste com itens mais antigos que
  `RUNTIME_BACKUP_RETENTION_DAYS` dias, `prune_runtime_backups` remove
  exatamente esses itens e preserva os demais.
- CA-003: em um diretorio de teste com mais itens que
  `RUNTIME_BACKUP_MAX_ITEMS` (mas todos dentro do limite de idade),
  `prune_runtime_backups` remove os mais antigos ate restar exatamente
  `RUNTIME_BACKUP_MAX_ITEMS` itens.
- CA-004: `scripts/deploy_stage_vps.sh` continua chamando
  `scripts/deploy_prod_vps.sh` sem nenhuma mudanca propria - a correcao vale
  para os dois ambientes automaticamente.

## 7) Casos de borda

- CB-001: `RUNTIME_BACKUP_DIR` inexistente (primeiro deploy num host novo) -
  `prune_runtime_backups` retorna sem erro.
- CB-002: diretorio existente mas vazio - ambas as buscas `find` retornam
  vazio, nenhuma poda, nenhum log.
- CB-003: todos os itens dentro dos dois limites (idade e quantidade) -
  nenhuma poda, nenhum log.

## 8) Fora de escopo

- Rotacao de `~/.npm` ou de qualquer outro consumidor de disco na VPS.
- Alertas/monitoramento automatico de uso de disco (ficou como sugestao para
  discussao futura, nao implementado aqui).
