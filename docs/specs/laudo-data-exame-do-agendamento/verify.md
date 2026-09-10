# Verify - laudo-data-exame-do-agendamento

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: pendente de verificacao manual

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 / RF-001 | aceitacao | `upload/page.test.tsx` - "usa a data agendada como default quando o upload vem de um agendamento" (agendamento em 2026-09-04, campo fica `2026-09-04`) | ok |
| CA-002 / RF-002 | aceitacao | `upload/page.test.tsx` - "cai para a data do dia quando o upload nao tem agendamento" (relogio fixo em 2026-09-10, campo fica `2026-09-10`) | ok |
| CA-003 / RF-003 | aceitacao | `upload/page.test.tsx` - "cai para a data do dia quando o agendamento nao carrega" (`GET /agenda/42` rejeitado, campo fica `2026-09-10`) | ok |
| CA-004 / RF-005 | aceitacao | campo segue controlado por `setDataExame` com `onChange`; o preenchimento automatico usa `current || ...`, entao valor digitado nao e sobrescrito. Revisao de codigo + cenario manual 4 | pendente (manual) |
| RF-004 | funcional | `toDateInput(item.data \|\| item.inicio)` em `upload/page.tsx`; o teste CA-001 envia `data` e `inicio` divergentes na intencao (`data` date-only) e o valor aceito e o de `data` | ok |
| RF-006 | funcional | `calendarDateInput(agendamento.data \|\| agendamento.inicio)` em `novo/page.tsx:preencherDadosDoAgendamento`; revisao de codigo | ok |
| NFR-001 | nao funcional | diff nao adiciona chamadas de rede; so muda ordem/origem do estado `dataExame` | ok |
| NFR-002 | nao funcional | nenhum arquivo em `backend/` alterado; payload do upload inalterado | ok |
| NFR-003 | nao funcional | datas continuam passando por `calendarDateInput` / `operationalTodayDateInput` | ok |
| Regressao | teste negativo | com o efeito de montagem antigo (`setDataExame((current) => current \|\| getTodayDateInput())` sem guarda), CA-001 falha: `Expected "2026-09-04" / Received "2026-09-10"` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npm run lint
npx vitest run
```

Resumo dos resultados:
- Backend: nao aplicavel (nenhum arquivo de `backend/` alterado).
- Frontend: `tsc` sem erros; `eslint --max-warnings=0` limpo;
  `vitest run` com 38 arquivos e 255 testes passando (inclui os 3 casos novos
  do upload de eletrocardiograma).
- Teste negativo: com a correcao revertida via `git stash`, a suite do arquivo
  novo ficou em 1 falha / 2 passes, exatamente no caso do agendamento.

## 3) Testes manuais

Pendentes em stage (nenhum executado ate o momento).

- Cenario 1: abrir a agenda, escolher um agendamento de eletrocardiograma de
  data passada e clicar no atalho de laudo. Esperado: "Data de realizacao" com
  a data do agendamento.
- Cenario 2: abrir Laudos > "Upload de eletrocardiograma" pelo menu, sem
  agendamento. Esperado: data de hoje.
- Cenario 3: abrir o upload com `?agendamento_id=` de um id inexistente.
  Esperado: data de hoje e o aviso "Nao foi possivel carregar o contexto do
  agendamento."
- Cenario 4: em qualquer um dos cenarios, trocar a data manualmente e enviar o
  PDF. Esperado: o laudo grava a data digitada.
- Cenario 5: abrir o ecocardiograma estruturado por um agendamento de data
  passada (`/laudos/novo?agendamento_id=<id>`). Esperado: "Data do exame" com a
  data do agendamento.

## 4) Regressao e riscos residuais

- Risco residual 1: enquanto `GET /agenda/{id}` esta em voo, o campo fica
  vazio por alguns instantes (antes ele ja mostrava hoje). A pagina exibe
  "Carregando dados do agendamento..." nesse intervalo, entao o estado e
  legivel; se o envio ocorresse nesse instante, a validacao de data do
  formulario cobriria o caso.
- Risco residual 2: quando o agendamento nao tem `data` e so tem `inicio`,
  a normalizacao de `inicio` (datetime sem timezone) pode recuar um dia para
  horarios entre 00:00 e 03:00 locais. Fora do horario de agenda da clinica.
- Nenhum comportamento existente de telemedicina foi alterado.
