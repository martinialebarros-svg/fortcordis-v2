# Verify — deploy-immutable-sha

Data: 2026-10-22
Status: validação local aprovada; publicação/teste em stage pendentes

## Matriz

| ID | Evidência | Status |
| --- | --- | --- |
| CA-001 | `test_deploy_immutable_sha.py`: main/stage avançam para outro SHA antes do reset; reset/HEAD permanecem no SHA solicitado; os dois workflows extraem por SHA. | ok |
| CA-002 | SHA/ref inválidos, branch inválida, commit alheio, fetch falho e objeto divergente abortam sem checkout/reset nem fallback. | ok |
| CA-003 | Ausência de SHA/ref é recusada inclusive no modo manual; entrada dos dois scripts não alcança comandos externos, serviços ou rollback; launcher preserva stage. | ok |
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
  forward-only. O modo legado manual foi removido neste complemento.

## Publicação

Autorizados commit, PR, merge e deploy somente em stage para esta validação.
Produção não está autorizada nesta etapa. Runs antigos conservam código antigo;
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

Publicação em stage e recusas no servidor serão registradas após conclusão dos
gates. Produção permanece sem autorização nesta etapa.
