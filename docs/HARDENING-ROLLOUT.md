# Hardening gradual sem quebra

Este roteiro foi pensado para ambientes onde producao ja esta estavel e o objetivo e endurecer seguranca e consistencia sem introduzir regressao.

## Endpoint de leitura

Use um usuario admin para consultar:

```text
GET /api/v1/admin/hardening-readiness
```

O endpoint responde se ja esta seguro:
- ativar `REQUIRE_UP_TO_DATE_MIGRATIONS`
- ativar `REQUIRE_STRONG_SECRET_KEY`
- desativar `ALLOW_LEGACY_PLAIN_PASSWORDS`
- desativar `ALLOW_PERMISSION_MATRIX_FALLBACK`

Tambem retorna um checklist de rollout para stage e producao.

## Ordem recomendada

1. Fazer deploy desta versao em stage sem mudar flags.
2. Validar `/health`, `/ready` e `/api/v1/admin/hardening-readiness`.
3. Ativar uma unica flag por deploy em stage.
4. Observar estabilidade antes do proximo passo.
5. Repetir em producao na mesma ordem validada em stage.

## Ordem das flags

1. `REQUIRE_UP_TO_DATE_MIGRATIONS`
2. `ALLOW_PERMISSION_MATRIX_FALLBACK`
3. `ALLOW_LEGACY_PLAIN_PASSWORDS`
4. `REQUIRE_STRONG_SECRET_KEY`

## Guardrails

- Nao ativar mais de uma flag no mesmo deploy.
- Se algum check voltar para vermelho, manter o fallback atual e corrigir a causa antes de prosseguir.
- Em producao, promover apenas flags que ficaram verdes em stage.
