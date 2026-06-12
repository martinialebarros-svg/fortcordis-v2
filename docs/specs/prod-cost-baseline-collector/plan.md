# Plan - prod-cost-baseline-collector

Data: 2026-06-09  
Responsavel: Martiniano + Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (escopo operacional): definir endpoints e formato de saida do baseline.
- Fase 2 (script): implementar CLI de coleta com opcoes de autenticacao.
- Fase 3 (higiene Git): garantir que snapshots locais nao sejam versionados.
- Fase 4 (validacao): compilar o script e confirmar guardrail SDD.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Mapear endpoints de Google Maps, custos/quotas e hardening readiness.
- [x] T1.2 Definir pasta local datada para saida operacional.
- Criterio de conclusao: endpoints e destino de artefatos registrados no spec.
- Risco: coletar informacao sensivel sem controle de versionamento.
- Rollback: remover o script e a regra de ignore antes do deploy.

### Fase 2

- [x] T2.1 Criar `scripts/prod_cost_baseline.py`.
- [x] T2.2 Implementar opcoes `--base-url`, `--output-root`, bearer token e credenciais.
- [x] T2.3 Escrever mensagens objetivas para falhas de autenticacao/conectividade.
- Criterio de conclusao: script executavel sem dependencias externas.
- Risco: fallback local indisponivel em ambientes sem backend configurado.
- Rollback: usar coleta manual autenticada ate ajustar o helper.

### Fase 3

- [x] T3.1 Adicionar `ops/baseline/prod/` ao ignore do Git.
- [x] T3.2 Confirmar que artefatos JSON gerados localmente ficam fora do versionamento.
- Criterio de conclusao: `git check-ignore` confirma a regra.
- Risco: snapshots antigos ja rastreados exigiriam remocao manual.
- Rollback: manter a regra e remover qualquer artefato rastreado antes de commit.

### Fase 4

- [x] T4.1 Rodar `python3 -m py_compile scripts/prod_cost_baseline.py`.
- [x] T4.2 Registrar evidencias em `verify.md`.
- [x] T4.3 Corrigir estrutura SDD com `intent.md`, `spec.md`, `plan.md` e `verify.md`.
- Criterio de conclusao: guardrail SDD passa para o diff de deploy.
- Risco: CI bloquear deploy por estrutura documental incompleta.
- Rollback: completar a estrutura documental sem alterar runtime.

## 3) Plano de testes

- Testes unitarios: `python3 -m py_compile scripts/prod_cost_baseline.py`.
- Testes de integracao: consulta autenticada manual aos endpoints de producao quando houver credencial valida.
- Testes manuais: `git check-ignore -v ops/baseline/prod/<snapshot>/_meta.json`.
- Guardrail: `python3 scripts/ci/check_sdd_guardrail.py --base-sha <base> --head-sha <head>`.

## 4) Dependencias e bloqueios

- Credencial valida para coleta real em producao.
- Backend de producao acessivel no momento da coleta.
- Regra de ignore ativa para impedir snapshots operacionais no Git.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido como local para compilacao e producao para coleta autenticada.
