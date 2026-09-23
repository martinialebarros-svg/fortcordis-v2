# Verify - agenda-reserva-whatsapp-manual

Data: 2026-09-22
Responsavel: Martiniano + Codex
Status: local-validated

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001/CA-002 | helper de prazo configuravel, padrao de tres horas e validacoes frontend/backend | passou |
| CA-003/CA-004 | compositor unico de reserva/agendamento com dados ou `Pendente` | passou |
| CA-005/CA-007/CA-008 | link `wa.me`, seletor de numero e fallback sem destino | passou |
| CA-006 | API/modelo/migracao e formulario de multiplos WhatsApps | passou |
| CA-009 | regressao de reserva sem paciente com `NULL` | passou |
| CA-010 | regressao cria novo registro no slot de reserva vencida e marca `Expirado` | passou |
| CA-011/CA-012 | edicao rapida de WhatsApp + endpoint parcial de clinica preservando os demais dados | passou |
| CA-013/CA-014 | alerta de ultima hora, estado critico nos 15 minutos finais e contagem regressiva da reserva | passou em lint, tipos e build |
| CA-015 | cancelamento da confirmacao interrompe a escrita e permite voltar ao WhatsApp | passou por inspecao do fluxo e build |
| CA-016/NFR-006 | confirmacao do slot expirado nao ignora conflito com agendamento ativo | passou |
| CA-017/CA-018/CA-019 | confirmacao tardia reativa `Expirado` somente com slot livre, dados obrigatorios e auditoria | passou |
| CA-020/NFR-007 | busca de tutor/animal exige escolha de resultado, remove falso selecionado e orienta a segunda etapa | passou localmente |
| NFR-001/NFR-004 | fallback legado e status expirado fora dos bloqueios ativos | passou |

## 2) Testes executados

```bash
backend/venv/bin/python -m unittest backend/tests/test_agenda_busca_periodo_filtros.py backend/tests/test_agenda_duracao_servico_create.py backend/tests/test_clinicas_whatsapp_multiplos.py backend/tests/test_migration_ci_cycle.py
backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
TZ=UTC backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
cd frontend && npm run lint
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run build
# Node + TypeScript transpile em memoria para validar prazo configuravel e os dois modelos de mensagem.
```

Resultados:

- Backend focado, custo constante e ciclo de migracao: 16 testes passaram.
- Suite backend completa: 326 testes passaram.
- Suite completa com timezone UTC do runner: 326 testes passaram.
- ESLint: passou sem avisos.
- TypeScript: passou sem erros.
- Build Next.js 15.5.14: passou com 33 paginas estaticas geradas.
- Prazo configuravel com padrao de tres horas e mensagens de reserva/agendamento: validacao funcional passou.
- Endpoint focado de WhatsApps da clinica: preservacao dos demais dados passou.
- Regressao de slot expirado: primeira tentativa retorna `CONFIRMACAO_SLOT_RESERVA_EXPIRADA`, a repeticao consciente ocupa o slot livre e um conflito ativo continua bloqueado.
- Regressao de confirmacao tardia: `Expirado` exige `CONFIRMACAO_REATIVACAO_RESERVA_EXPIRADA`, muda para `Agendado` quando livre e permanece bloqueado quando o slot ja foi ocupado.
- Frontend: alerta destacado na ultima hora, estado critico nos 15 minutos finais e confirmacao com orientacao para revisar o WhatsApp.

### Atualizacao de 2026-09-22

```bash
cd frontend && npx vitest run app/agenda/NovoAgendamentoModal.reserva-expirada.test.tsx
cd frontend && npx vitest run app/agenda/NovoAgendamentoModal.reserva-expirada.test.tsx app/agenda/NovoAgendamentoModal.excecao-manual.test.tsx app/agenda/NovoAgendamentoPedido.test.tsx
cd frontend && npm test
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest backend/tests/test_agenda_duracao_servico_create.py backend/tests/test_agenda_excecao_deslocamento_persistente.py
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
# evaluate_guardrail aplicado ao git diff e aos arquivos ainda nao rastreados
```

- Regressao do modal: o texto digitado permanece somente como filtro ate a escolha de um resultado; ao selecionar tutor e animal, o `PUT` preserva `Expirado` e envia os IDs vinculados.
- A reserva expirada nao apresenta mais `Tutor nao informado` como tutor selecionado.
- Depois de salvar os dados, o modal retorna para a Agenda e orienta `Agendar apos confirmacao tardia`, mantendo a revalidacao de slot e rota no fluxo existente.
- Teste novo: 2 testes passaram; regressao dos tres modais da Agenda: 6 testes passaram.
- Suite frontend completa: 53 arquivos e 408 testes Vitest, mais 9 testes Node, passaram.
- Backend focado em confirmacao tardia e conflito de deslocamento: 23 testes passaram.
- TypeScript, ESLint, build Next.js com 43 paginas, `git diff --check` e guardrail SDD sobre o working tree passaram.

### Atualizacao de 2026-08-02

```bash
backend/venv/bin/python -m unittest backend/tests/test_agenda_busca_periodo_filtros.py backend/tests/test_agenda_duracao_servico_create.py backend/tests/test_assistente_ia_admin.py
backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
TZ=UTC backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- Backend focado: 50 testes passaram, incluindo confirmacao tardia com slot livre e conflito com slot reocupado.
- Suite backend completa: 529 testes passaram.
- Suite backend completa com `TZ=UTC`: 529 testes passaram.
- TypeScript e ESLint: passaram sem erros ou avisos.
- Build Next.js 15.5.14: passou com 39 paginas geradas.
- `git diff --check`: passou.
- Guardrail SDD sobre o `origin/stage` atual: passou.
- Candidato validado para publicacao condicionada aos workflows e smokes de stage e producao.
- Candidato de producao criado por merge de `origin/stage` sobre `origin/main`, preservando a permissao de exclusao da recepcao.
- Candidato combinado: 359 testes backend passaram com `TZ=UTC`.
- No candidato combinado, ESLint, TypeScript e build Next.js passaram; 34 paginas foram geradas.

## 3) Verificacoes de release

- `git diff --check origin/main..HEAD`: passou.
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/main --head-sha HEAD`: passou.
- Correcoes exclusivas de producao para exclusao da agenda foram preservadas no merge.
- No `stage`, `Migration CI` e `Deploy to Stage (VPS)` do commit `772f4e4` terminaram com sucesso.
- Workflows de producao e smoke final: executar apos push para `main`.

## 4) Riscos residuais

- `wa.me` depende do navegador e da sessao do WhatsApp do usuario.
- O envio permanece manual enquanto a Meta analisa a empresa.
- Nome do medico e especialidade seguem o modelo operacional atual; uma equipe multiprofissional exigira configuracao futura.

## 5) Decisao de release

- [x] Aprovado para stage, condicionado ao guardrail e workflows finais.
- [x] Aprovado para producao, condicionado aos workflows e smoke pos-deploy.
