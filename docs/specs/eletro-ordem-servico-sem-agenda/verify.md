# Verify — OS no upload de eletro sem Agenda

Data: 2026-10-05
Status: validado localmente; publicação autorizada em 2026-10-05

## Validações

- Backend: upload opt-in/opt-out, preço negociado/tabela, permissão,
  ausência de Agenda, persistência e listagem financeira, repetição e
  conflito, rollback, troca de PDF, proteção de identidade/exclusão.
- Migração: SQLite com dados/índices existentes e reexecução; contrato SQL
  PostgreSQL e ciclo de migrações conforme infraestrutura disponível.
- Frontend: opção padrão desligada, campos obrigatórios, prévia de preço,
  falha e resposta atrasada, payload, retry, contexto com Agenda e card da OS.
- Regressão: Laudos, Financeiro, portal, finalização de Atendimento/Agenda.
- Qualidade: TypeScript, ESLint, build Next.js, `git diff --check` e
  guardrail SDD incluindo arquivos novos ainda não rastreados.

## Resultados locais

| ID | Evidência | Status |
| --- | --- | --- |
| CA-001 | Upload cria OS pendente, vínculo com laudo, preço negociado e zero agendamentos; smoke HTTP e 18 testes backend | aprovado localmente |
| CA-002 | Upload sem OS e substituição de PDF preservam comportamento e cobrança; regressão automatizada | aprovado localmente |
| CA-003 | Clínica/paciente/serviço inativos, preço zero, permissão insuficiente e contexto de agenda rejeitados | aprovado localmente |
| CA-004 | Retry e concorrência retornam uma única cobrança; rollback de auditoria e persistência após commit | aprovado localmente |
| CA-005 | Migração repetida em SQLite e PostgreSQL 16.13 preserva registros, índices e unicidade | aprovado localmente |
| CA-006 | UI descarta prévia obsoleta, exige confirmação de serviço e preserva chave em retry | aprovado localmente |

- Backend: `unittest discover` no mesmo modo de processo do CI
  (`FORTCORDIS_PROCESS_ROLE=api`), SQLite temporário: **1541 testes,
  sucesso, 7 ignorados**. Inclui 18 novos testes de OS de eletro/migração.
- Frontend: `npm test`: **514 testes Vitest em 73 arquivos + 9 testes
  Node**, todos aprovados. Os cenários focados incluem 16 testes de
  upload/card e 22 do Financeiro (4 novos de cancelamento/identidade).
- `npm run lint`, `npm run build`, `tsc --noEmit --pretty false`,
  `git diff --check` e guardrail SDD:
  aprovados. O guardrail usou o inventário de alterações de `HEAD` e de
  arquivos não rastreados, já que não foi criado commit nesta entrega.
- Migração SQLite executada duas vezes com registros e índices/triggers
  existentes: preservação e unicidade aprovadas. Ciclo global de migrações
  também coberto pela suíte backend.
- PostgreSQL **16.13**, cluster temporário isolado: upgrade duas vezes,
  preservação de OS antiga/defaults/índices, múltiplas agendas nulas,
  unicidade de número/agenda ativa/laudo ativo/chave e retenção da chave
  após cancelar: aprovados. Duas transações concorrentes com a mesma chave
  resultaram em exatamente **1 commit + 1 rejeição por unicidade**.
  Cluster parado ao final; evidência em
  `/tmp/fortcordis-eletro-os-pg-ynrn_1k0/migration-proof.json`.

### Smoke HTTP e navegador isolados

API com os routers reais e autenticação sintética, banco e uploads em
`/tmp/fortcordis-eletro-os-qa.mhaOGk`; sem inicialização de workers, jobs ou
acesso a dados de operação.

- Prévia usou preço negociado **R$ 95,00**, acima de zero e distinto do
  preço padrão sintético **R$ 120,00**.
- POST multipart real retornou `201`, OS `OS-LAUDO-1`, `Pendente`, R$ 95,00.
- Repetições com a mesma chave retornaram os mesmos IDs. Banco confirmou
  exatamente **1 laudo, 1 OS, 1 anexo, 1 auditoria e 0 agendamentos**.
- GET detalhe e listagem de OS confirmaram `laudo_id` e destinatário clínica.
- Download original foi comparado byte a byte ao PDF sintético enviado.
- Cancelamento HTTP retornou `200`, preservou laudo, PDF e OS cancelada.
- No navegador: checkbox inicialmente desligado, seleção explícita de
  serviço, prévia de R$ 95,00, card da OS após carregar/recarregar o laudo e
  link abrindo a OS correta no Financeiro foram comprovados visualmente.
- Limite do navegador automatizado: o seletor de arquivos do IAB não
  emitiu `filechooser`; o upload foi validado por HTTP e por testes do
  componente. A confirmação nativa de cancelamento também travou a
  automação, portanto o cancelamento final foi verificado por HTTP e
  testes de componente, sem alegar ponta a ponta desses dois gestos no IAB.

Logs temporários: `backend-tests-ci.log`, `frontend-tests.log`,
`frontend-build.log`, `frontend-lint.log`, `http-smoke.json` no diretório
acima. Uma execução inicial da suíte sem `FORTCORDIS_PROCESS_ROLE=api`
iniciou workers sobre SQLite em memória e encerrou com erro do processo;
a execução repetida no modo do CI concluiu integralmente.

## Limites

O usuário autorizou a publicação após a validação local. A entrega seguirá
por PR de feature para stage e promoção direta stage → main, com os checks
e deploys concluídos antes de declarar publicação. O smoke publicado será
somente leitura; a migração é parte do deploy autorizado. Nenhuma cobrança,
laudo ou mensagem real será criado para comprovar funcionamento.
