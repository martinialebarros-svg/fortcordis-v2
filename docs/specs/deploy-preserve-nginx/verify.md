# Verify — Preservar Nginx por publicação

| ID | Status | Evidência |
|---|---|---|
| CA-NG-01 | aprovado local | Tabela verdade: sem marcador1/1; com marcador0/0, tanto push quanto dispatch. |
| CA-NG-02 | aprovado local | Mensagem maliciosa não é avaliada/ecoada; leitura do commit falha se ausente. |
| CA-NG-03 | aprovado local | Doubles confirmam ausência de chamadas Nginx/helper/reload com flags0, inclusive rollback, sem acesso ao servidor. |
| CA-NG-04 | aprovado local | Seis testes novos,13 immutableSHA, YAML/bash e isolamento aprovados; regressão incluída no quality-gate. |

Código alterado somente em .github/workflows/deploy.yml e scripts/tests/test_prod_nginx_preserve_workflow.py. Fonte de flags: mensagem do próprio DEPLOY_SHA validado, não texto de evento interpolado. Confirmação operacional dos skips e versão instalada integra a conclusão do deploy de produção, registrada nos artefatos da entrega; testes locais não são alegados como execução remota.
