# Verificacao

## Testes automatizados
- `backend/tests/test_push_scheduler_service.py`
  - processa ate o limite configurado
  - nao processa quando lock distribuido estiver ocupado
  - aplica `with_for_update(skip_locked=True)` no caminho Postgres

## Validacao operacional (stage/prod)
1. Subir duas instancias com scheduler ativo.
2. Inserir lote de registros pendentes em `push_scheduled_notifications`.
3. Confirmar que cada registro muda de estado uma unica vez, sem duplicidade de envio.
4. Verificar logs para ciclos ignorados por lock ocupado em instancia concorrente.
