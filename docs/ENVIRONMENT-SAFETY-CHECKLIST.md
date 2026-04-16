# Environment Safety Checklist

## Matriz oficial de ambientes

Use esta tabela como fonte de verdade antes de qualquer deploy, seed, reset de dados ou manutencao no Supabase.

| Ambiente | Organizacao Supabase | Projeto Supabase | Project ref | Plano | VPS |
|---|---|---|---|---|---|
| Prod | `martinialebarros-svg's Org` | `fortcordis-prod` | `wycxoueogfxdhyouhfhw` | `Pro` | `/var/www/fortcordis-v2` |
| Stage | `Fortcordis Stage` | `martinialebarros-svg's Project` | `dtguubpzjrkvqjryazjq` | `Free` | `/var/www/fortcordis-stage` |

## Padrao de nomenclatura recomendado

Para reduzir risco operacional, use nomes explicitos em todos os lugares:

- Supabase prod: `fortcordis-prod`
- Supabase stage: `fortcordis-stage`
- VPS prod: `/var/www/fortcordis-v2`
- VPS stage: `/var/www/fortcordis-stage`
- Branch prod: `main`
- Branch stage: `stage`

Observacao:

- O projeto stage ainda esta com nome generico no Supabase. Renomeie manualmente para `fortcordis-stage` quando puder.

## Checklist rapido antes de qualquer acao sensivel

1. Confirmar o ambiente no topo do painel do Supabase.
2. Confirmar o `project ref`.
3. Confirmar o caminho da VPS.
4. Confirmar a branch Git.
5. Confirmar que `prod` e `stage` usam `DATABASE_URL` diferentes.

## Checklist antes de deploy em stage

1. `git rev-parse --abbrev-ref HEAD` deve retornar `stage`.
2. O deploy deve acontecer em `/var/www/fortcordis-stage`.
3. O banco deve apontar para `dtguubpzjrkvqjryazjq`.
4. Nunca reutilizar `PROD_DATABASE_URL` no stage.

## Checklist antes de deploy em prod

1. `git rev-parse --abbrev-ref HEAD` deve retornar `main`.
2. O deploy deve acontecer em `/var/www/fortcordis-v2`.
3. O banco deve apontar para `wycxoueogfxdhyouhfhw`.
4. Rodar validacao de isolamento antes do deploy.

## Comando de validacao na VPS

```bash
python3 scripts/check_environment_matrix.py
```

Saida esperada:

- `PROD` com ref `wycxoueogfxdhyouhfhw`
- `STAGE` com ref `dtguubpzjrkvqjryazjq`
- status `OK` nos dois ambientes

## Regras de ouro

1. Nunca executar seed/reset em ambiente sem checar `project ref`.
2. Nunca confiar apenas no nome visual do projeto.
3. Em caso de duvida, validar o usuario do pooler: `postgres.<project_ref>`.
4. Se o stage parecer indisponivel, lembrar que o plano Free pode pausar por inatividade.
