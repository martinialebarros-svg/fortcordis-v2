# Verify - assistente-laudo-voz

Data: 2026-07-25
Responsável: Martiniano + Codex
Status: local_pass_stage_pending

## Matriz

| Critério | Evidência | Status |
| --- | --- | --- |
| CA-001 | componente compilado com gravação, pausa, upload, reprodução, exclusão e regravação; smoke no navegador pendente | local_pass |
| CA-002 | transcrição original somente leitura e cópia editável antes de `/structure` | local_pass |
| CA-003 | Pydantic estrito, Structured Outputs e UI com edição/rejeição, origem e confiança | local_pass |
| CA-004 | testes de decimal, negativo, unidade, percentual, contradição e `ΔP = 4 × V²` | local_pass |
| CA-005 | teste aplica somente `s1`, preserva `s2` e registra edição | local_pass |
| CA-006 | teste confirma `descricao`, `diagnostico` e status oficiais inalterados | local_pass |
| CA-007 | callback força `Rascunho`; endpoint retorna `report_persisted=false` | local_pass |
| CA-008 | teste de serviço e integração HTTP retornam 404 para outro usuário | local_pass |
| CA-009 | testes de exclusão manual e `cleanup_expired_audio()` | local_pass |
| CA-010 | testes da flag desativada e chave ausente | local_pass |
| CA-011 | upgrade repetido, downgrade restrito e ciclo global de migrations | local_pass |
| CA-012 | 427 testes, pip check, ESLint, TypeScript e build Next.js | local_pass |
| CA-013 | deploy `30177544271` aprovado até o VPS; canary detectou falha interna na transcrição e motivou instrumentação segura por subetapa | in_progress |
| CA-014 | `origin/main` e produção sem alteração | pendente |

## Evidência local executada

```bash
cd backend
./venv/bin/python -m unittest \
  tests/test_ai_echo_voice_assistant.py \
  tests/test_ai_echo_migration.py
# 24 testes, OK
./venv/bin/python -m unittest discover -s tests -p "test_*.py"
# 427 testes, OK
./venv/bin/python -m pip check
# No broken requirements found.
./venv/bin/python -m unittest tests/test_migration_ci_cycle.py
# 1 teste, OK

cd ../frontend
npx eslint app/laudos/components/EchoVoiceAssistant.tsx \
  'app/laudos/[id]/editar/page.tsx' --max-warnings=0
npx tsc --noEmit --pretty false
npm run lint
NODE_OPTIONS='--max-old-space-size=1536' \
  NEXT_TELEMETRY_DISABLED=1 npx next build --no-lint
# build otimizado, tipos, 36 páginas e traces, OK

cd ..
git diff --check
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy-stage.yml")'
```

O `check_sdd_guardrail.py` depende de um `HEAD` commitado e será executado antes
do push de `stage`.

## Homologação

O deploy `30177544271` concluiu no VPS com `HEAD=5acfee7`, migrations, readiness,
zero 5xx, worker de limpeza, canary autenticado geral e restore drill aprovados.
O canary específico descartável falhou antes de registrar a transcrição com
`processing_failed`; os registros e o áudio artificiais foram removidos pelo
`finally`. A repetição inclui telemetria de subetapa sem conteúdo clínico. Usar
somente caso artificial, sem nome, telefone, endereço, documento ou dado oficial.
