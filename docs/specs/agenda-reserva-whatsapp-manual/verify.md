# Verify - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: verified-for-production

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001/CA-002 | helper de prazo em tres horas + validacoes frontend/backend | passou |
| CA-003/CA-004 | compositor unico de reserva/agendamento com dados ou `Pendente` | passou |
| CA-005/CA-007/CA-008 | link `wa.me`, seletor de numero e fallback sem destino | passou |
| CA-006 | API/modelo/migracao e formulario de multiplos WhatsApps | passou |
| CA-009 | regressao de reserva sem paciente com `NULL` | passou |
| CA-010 | regressao cria novo registro no slot de reserva vencida e marca `Expirado` | passou |
| NFR-001/NFR-004 | fallback legado e status expirado fora dos bloqueios ativos | passou |

## 2) Testes executados

```bash
backend/venv/bin/python -m unittest backend/tests/test_agenda_busca_periodo_filtros.py backend/tests/test_agenda_duracao_servico_create.py backend/tests/test_clinicas_whatsapp_multiplos.py backend/tests/test_migration_ci_cycle.py
backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
TZ=UTC backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
cd frontend && npm run lint
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run build
# Node + TypeScript transpile em memoria para validar prazo e os dois modelos de mensagem.
```

Resultados:

- Backend focado, custo constante e ciclo de migracao: 16 testes passaram.
- Suite backend completa: 326 testes passaram.
- Suite completa com timezone UTC do runner: 326 testes passaram.
- ESLint: passou sem avisos.
- TypeScript: passou sem erros.
- Build Next.js 15.5.14: passou com 33 paginas estaticas geradas.
- Prazo de tres horas e mensagens de reserva/agendamento: validacao funcional passou.
- Candidato de producao criado por merge de `origin/stage` sobre `origin/main`: 338 testes backend passaram com `TZ=UTC`.
- No candidato de producao, ESLint, TypeScript e build Next.js passaram; 33 paginas estaticas foram geradas.

## 3) Verificacoes de release

- `git diff --check origin/main..HEAD`: passou.
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD`: passou.
- Correcoes exclusivas de producao para exclusao da agenda foram preservadas no merge.
- No `stage`, `Migration CI` e `Deploy to Stage (VPS)` do commit `ce9f41c` terminaram com sucesso.
- Workflows de producao e smoke final: executar apos push para `main`.

## 4) Riscos residuais

- `wa.me` depende do navegador e da sessao do WhatsApp do usuario.
- O envio permanece manual enquanto a Meta analisa a empresa.
- Nome do medico e especialidade seguem o modelo operacional atual; uma equipe multiprofissional exigira configuracao futura.

## 5) Decisao de release

- [x] Aprovado para stage, condicionado ao guardrail e workflows finais.
- [x] Aprovado para producao, condicionado aos workflows e smoke pos-deploy.
