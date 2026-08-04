# Verify - deploy-backup-rotation

Data: 2026-08-03
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `bash -n scripts/deploy_prod_vps.sh` -> `sintaxe OK`. | ok |
| CA-002 | aceitacao | Diretorio sintetico com 30 itens com mtime forcado para 2026-06-24 (`touch -t`, ~40 dias antes de hoje) e 10 itens recentes (mtime atual). `RUNTIME_BACKUP_RETENTION_DAYS=30` -> log `Pruned 30 runtime backup item(s) com mais de 30 dias`, total apos poda: 10, todos `recent_*` (nenhum `old_*` restante). | ok |
| CA-003 | aceitacao | Diretorio sintetico com 250 itens (100 `old_*` criados primeiro, 150 `recent_*` depois, sem diferenciacao artificial de mtime). `RUNTIME_BACKUP_MAX_ITEMS=200` -> log `Pruned 50 runtime backup item(s) adicionais para manter no maximo 200 itens`, total apos poda: 200 (os 50 criados primeiro, portanto com mtime mais antigo, foram removidos). | ok |
| CA-004 | aceitacao | `scripts/deploy_stage_vps.sh` inspecionado - continua so exportando variaveis e chamando `bash "${SCRIPT_DIR}/deploy_prod_vps.sh"` na ultima linha, sem nenhuma referencia a backups; nenhuma mudanca necessaria nesse arquivo. | ok |

## 2) Testes automatizados executados

Nao aplicavel - script operacional sem harness de teste em `pytest`/CI.
Validacao feita via testes manuais isolados (secao 3).

## 3) Testes manuais

**Teste de sintaxe:**
```bash
bash -n scripts/deploy_prod_vps.sh
```
Resultado: `sintaxe OK`.

**Teste de poda por idade (CA-002):** funcao `prune_runtime_backups`
extraida via `sed` e executada num diretorio temporario com 30
subdiretorios `old_*` (mtime forcado para `2026-06-24 00:00`, via `touch -t
202606240000` - sintaxe POSIX, ao contrario de `touch -d "N days ago"` que e
uma extensao GNU indisponivel no `touch` do macOS usado para rodar o teste
local) e 10 subdiretorios `recent_*` (mtime atual, no momento da criacao).
Com `RUNTIME_BACKUP_RETENTION_DAYS=30`:

```
Total inicial:       40
Pruned 30 runtime backup item(s) com mais de 30 dias em .../backups
Total apos poda:       10
Restantes 'old_*': 0
Restantes 'recent_*': 10
```

**Teste de poda por quantidade (CA-003):** mesmo metodo, diretorio com 100
`old_*` + 150 `recent_*` (250 no total, todos com mtime "atual" mas criados
em sequencia, `old_*` primeiro). Com `RUNTIME_BACKUP_MAX_ITEMS=200`:

```
Total inicial:      250
Pruned 50 runtime backup item(s) adicionais para manter no maximo 200 itens em .../backups
Total apos poda:      200
```

Nota metodologica: a extensao GNU `touch -d "N days ago"` nao funciona no
`touch` (BSD) do macOS usado para os testes locais - por isso o teste de
idade (CA-002) foi refeito com `touch -t` (sintaxe POSIX, suportada tanto por
GNU quanto por BSD `touch`) para forcar o mtime corretamente. A logica
`find -mtime "+N"` em si (usada em producao, onde o script sempre roda via
SSH num shell Linux/GNU) ja havia sido validada de forma independente contra
a VPS real durante o diagnostico do incidente de disco cheio em 2026-08-03,
quando o mesmo padrao de busca encontrou corretamente 1194 itens com mais de
30 dias em `~/fortcordis-runtime-backups`.

## 4) Regressao e riscos residuais

- Nenhum risco residual conhecido. A poda so remove itens acima dos limites
  configurados (30 dias / 200 itens, ambos generosos frente ao uso real de
  rollback manual) e roda antes de qualquer novo backup ser criado no deploy
  atual, entao nunca poda o proprio backup que esta sendo gerado.
- `find -printf` (usado na poda por quantidade) e uma extensao GNU - sem
  impacto, pois o script roda exclusivamente na VPS (Linux/GNU coreutils),
  nunca localmente em macOS.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
