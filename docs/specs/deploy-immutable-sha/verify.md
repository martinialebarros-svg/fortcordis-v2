# Verify — deploy-immutable-sha

Data: 2026-10-22
Status: homologação em stage aprovada; produção autorizada e em preparação

## Matriz

| ID | Evidência | Status |
| --- | --- | --- |
| CA-001 | `test_deploy_immutable_sha.py`: main/stage avançam para outro SHA antes do reset; reset/HEAD permanecem no SHA solicitado; os dois workflows extraem por SHA. | ok |
| CA-002 | SHA/ref inválidos, branch inválida, commit alheio, fetch falho e objeto divergente abortam sem checkout/reset nem fallback. | ok |
| CA-003 | Ausência de SHA/ref é recusada inclusive no modo manual; entrada dos dois scripts não alcança comandos externos, serviços ou rollback; launcher preserva stage. | ok |
| CA-004 | 9 testes novos, 23 testes de gates relacionados, 8 scripts de regressão, sintaxe bash/YAML/71 blocos run; sync ainda exige `github.sha`; divergência de HEAD continua acionando rollback simulado. | ok |
| CA-005 | Stage `d1e81bba`, workflow `39846709890` completed/success; SHA instalada e arquivos executáveis idênticos ao commit; canário, restore drill e smoke aprovados. | ok |

## Validação local executada

- `python3 scripts/tests/test_deploy_immutable_sha.py`: 9 testes aprovados,
  com subcasos de main/stage, contexto inválido e falhas de resolução.
- `bash -n scripts/deploy_prod_vps.sh` e `bash -n scripts/deploy_stage_vps.sh`.
- Parse YAML dos dois workflows e `bash -n` dos 26 blocos run de produção e
  45 de stage, substituindo apenas expressões GitHub por texto sintético.
- `python -m unittest backend.tests.test_stage_auth_release_isolation
  backend.tests.test_deploy_authenticated_canary
  backend.tests.test_deploy_backup_restore_drill
  backend.tests.test_runtime_observability_gate`: 23 aprovados com
  `DATABASE_URL=sqlite://`, chave sintética e `FORTCORDIS_PROCESS_ROLE=api`.
  A primeira execução sem esse contexto falhou em dois imports por ausência
  de `DATABASE_URL`; a repetição com configuração sintética passou, sem mudar
  código Auth ou usar credenciais reais.
- Scripts de testes aprovados: `test_whatsapp_stage_meta_isolation.sh`,
  `test_whatsapp_reminder_activation.sh`,
  `test_vps_ingress_diagnostics_stage_trigger.sh`,
  `test_nginx_http2_enablement.sh`,
  `test_collect_vps_ingress_diagnostics.sh`, `test_probe_public_https.sh`,
  `test_monitor_vps_ingress_deltas.sh` e
  `test_nginx_tls_listener_inventory.sh`.
- `git diff --check`: aprovado.

Os ensaios substituem Git, launchers, HTTP e serviços por dublês/fixtures;
nenhum reset, fetch remoto, endpoint real, serviço ou dado operacional é
acionado pelos testes.

## Limites

- Stage comprovado no SHA `d1e81bba`, incluindo 13 regressões e quatro recusas sem mutação operacional.
- Runs antigos conservam o YAML antigo; reexecutá-los não aplica esta correção.
- O fetch de SHA deve ser permitido pelo remoto. Commit removido da história
  da branch ou fetch malsucedido aborta; não há troca pela ponta atual.
- Rollback e migrações mantêm seu contrato anterior, inclusive schema
  forward-only. O modo legado manual foi removido neste complemento.

## Publicação

Homologação concluída em stage. Em 22/10/2026 o usuário autorizou publicar
somente deploy, testes e documentação em produção com backup, rollback e prova
do SHA. Runs antigos conservam código antigo;
não são corrigidos retroativamente por esta mudança.

## Complemento autorizado nesta tarefa (22/10/2026)

A base stage já continha a primeira implementação de SHA imutável, integrada
pelo PR #413 junto de uma entrega clínica. Este complemento altera somente os
dois workflows de deploy, o instalador compartilhado, seus testes e este SDD.
Não inclui mudanças funcionais de Auth, Maps, Agenda ou laudos.

| ID | Evidência adicional | Status |
| --- | --- | --- |
| CA-006 | Blocos reais de preflight SSH dos dois workflows executados com remoto Git descartável: SHA válido aceito e inexistente recusado, sem alterações em HEAD, ambiente ou backups. Ordem anterior à configuração verificada. | ok |

- `python3 scripts/tests/test_deploy_immutable_sha.py`: 13 testes aprovados.
  Os quatro testes adicionais usam repositórios Git locais descartáveis e
  launchers isolados. Com main/stage avançando novamente após a resolução,
  somente a árvore aprovada foi instalada. Commit inexistente ou de outra
  história foi recusado sem mudar HEAD, ambiente ou criar backups.
- Sem fallback manual; teste da entrada completa dos dois scripts comprova
  recusa de identidade ausente/inválida antes de comandos operacionais.
- 23 testes de isolamento stage, canário, restore drill e observabilidade
  aprovados com SQLite e chave sintética.
- Regressões shell de isolamento Meta e ativação controlada de lembretes
  aprovadas com dublês, sem mensagens ou serviços reais.
- Sintaxe bash dos dois instaladores e `git diff --check` aprovados.

Homologação terminal: [stage 39846709890](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/39846709890)
completed/success no SHA `d1e81bba026e6398e58f7ac5d010b6e698a33ea2`.
Preflight remoto terminou antes da primeira configuração; 13 testes instalados
aprovados e quatro tentativas reais recusadas (identidade ausente, SHA malformado,
ref incompatível e commit inexistente) sem alteração de HEAD, configurações,
backups, runtime ou processos. Seis arquivos preservados/restaurados e
`Backup restore drill OK`. Canário 5/5, p95 364,47 ms; API/worker/frontend ativos.
Canônico e alias 200; API autenticada anônima 401. CI completo: 2.108 testes backend.

Produção era `3553c461` e permaneceu com ambiente/processos iguais durante essa
homologação. A autorização posterior permite agora a publicação isolada por
hotfix: somente os nove caminhos de deploy/testes/SDD; nenhuma mudança funcional
de Maps, Agenda, Auth ou laudos. Nenhum critério requer dispensa neste pacote.

A evidência posterior da instalação produtiva será registrada no PR e no pacote
local de publicação; não se conta preparação ou workflow em execução como sucesso.
