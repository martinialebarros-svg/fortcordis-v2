# Spec — Preservar Nginx por SHA de publicação

- RF-01: após validar/fetch do DEPLOY_SHA, ler somente sua mensagem com `git show`; não interpolar texto de commit no shell, não avaliar nem logar o conteúdo.
- RF-02: mensagem contendo o marcador literal [preserve-nginx] seleciona ENABLE_NGINX_HTTP2=0 e RELOAD_NGINX_ON_DEPLOY=0; ausência mantém os defaults explícitos1/1. A regra depende do SHA, tanto em push quanto em dispatch, sem modificar o input de reminder. Commit indisponível falha fechado.
- RF-03: passar as duas flags ao installer já existente, sem nginx.conf/TLS/CSP/credencial/permissão ou serviço novo. Flags0 também valem se houver rollback. Log registra apenas SHA/flags e skips operacionais existentes.
- RF-04: executar a regressão dedicada no quality-gate de produção. O merge final autorizado de laudos em main contém o marcador e seus logs precisam confirmar os dois skips antes de declarar a publicação concluída. Outros deploys continuam1/1.

Rollback de código mantém as flags herdadas nesta execução. Remover o marcador em um futuro SHA restaura o comportamento anterior, sem nova configuração persistente do servidor.
