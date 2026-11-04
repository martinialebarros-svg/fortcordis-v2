# Plan — Preservar Nginx por publicação

1. Adicionar seleção de flags pela mensagem do SHA imutável em deploy.yml.
2. Testar marcador presente/ausente em push/dispatch, mensagem maliciosa, commit ausente e installer sem chamadas reais de Nginx/helper/systemctl, incluindo rollback.
3. Validar isolamento/immutableSHA, YAML/bash e SDD; promover a salvaguarda junto ao recorte de laudos, pelo fluxo stage→main.
4. No merge final main usar [preserve-nginx]; aguardar terminal e conferir os dois skips, health/canário/backup/restore. Não assumir skips a partir do título do PR ou de sucesso de stage.
