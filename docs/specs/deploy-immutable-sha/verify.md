# Verify — deploy-immutable-sha

Data: 2026-10-22
Status: validação local aprovada; publicação/teste em stage pendentes

## Matriz

| ID | Evidência | Status |
| --- | --- | --- |
| CA-001 | `test_deploy_immutable_sha.py`: main/stage avançam para outro SHA antes do reset; reset/HEAD permanecem no SHA solicitado; os dois workflows extraem por SHA. | ok |
| CA-002 | SHA/ref inválidos, branch inválida, commit alheio, fetch falho e objeto divergente abortam sem checkout/reset nem fallback. | ok |
| CA-003 | Modo legado fixa uma resolução com aviso; launcher simulado recebe SHA/ref, branch stage e opt-in de produção desligado. | ok |
| CA-004 | 9 testes novos, 23 testes de gates relacionados, 8 scripts de regressão, sintaxe bash/YAML/71 blocos run; sync ainda exige `github.sha`; divergência de HEAD continua acionando rollback simulado. | ok |
| CA-005 | Validação local sem rede/serviços/banco real aprovada; publicação, SHA instalada e smoke de stage aguardam a tarefa principal. | pendente |

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

- Ainda não há prova de instalação desta correção em stage.
- Runs antigos conservam o YAML antigo; reexecutá-los não aplica esta correção.
- O fetch de SHA deve ser permitido pelo remoto. Commit removido da história
  da branch ou fetch malsucedido aborta; não há troca pela ponta atual.
- Rollback e migrações mantêm seu contrato anterior, inclusive schema
  forward-only. O modo legado manual não representa uma revisão gateada.

## Publicação

Nenhum commit, push, merge, rerun ou deploy é realizado pela implementação.
Stage e sua revisão instalada devem ser conferidos pela tarefa principal após
os gates. Produção não está autorizada nesta etapa.
