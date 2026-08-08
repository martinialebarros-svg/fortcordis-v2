# Verify - portal-clinica-agendamentos-ativos

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_lista_apenas_agendamentos_ativos_da_propria_clinica` (backend/tests/test_portal_clinica_agendamentos.py) | ok |
| CA-002 | aceitacao | mesmo teste acima: item "Em atendimento" nao seria incluido no set visivel sem `pode_cancelar`; cobertura direta de `pode_cancelar=false` fica no calculo de `_build_portal_agendamento_item` (nao ha item "Em atendimento" no seed atual) | parcial — ver risco residual 1 |
| CA-003 | aceitacao | `test_cancela_agendamento_pendente_da_propria_clinica` | ok |
| CA-004 | aceitacao | `test_nao_cancela_agendamento_de_outra_clinica` | ok |
| CA-005 | aceitacao | `test_nao_cancela_agendamento_ja_realizado` | ok |
| CA-006 | aceitacao | Leitura de codigo: bloco JSX envolvido em `{!isAdminPreview ? (...) : null}` em `PortalClinicaWorkspace.tsx`; sem teste de componente (nao ha suite de componente para este arquivo). | parcial (logica revisada, nao testada em navegador) |
| NFR-001 | nao funcional | `_exigir_sessao_clinica_portal` sempre usa `portal_session.clinica_id`; nenhum endpoint novo aceita `clinica_id` como query/body. | ok |
| NFR-002 | nao funcional | Schemas novos (`PortalClinicaAgendamentoItemResponse`) nao incluem `observacoes`, `criado_por_nome` nem campos de `Transacao`/`ContaPagar`/`ContaReceber`. | ok |
| NFR-003 | nao funcional | `cancelar_agendamento_clinica_portal` chama `_adquirir_lock_escrita_agenda(db)` antes de validar/alterar. | ok (revisado; concorrencia real nao testada) |
| NFR-004 | nao funcional | `registrar_auditoria` chamado no cancelamento; teste verifica chamada com `acao="cancelar"` e `detalhes.clinica_id`. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend (a partir da raiz do repo, mesma invocacao do CI em deploy-stage.yml)
DATABASE_URL=sqlite:///./fortcordis-ci.db \
SECRET_KEY=deploy-stage-quality-gate-secret-key-1234567890 \
python -m unittest discover -s backend/tests -p "test_*.py"

# frontend
npx tsc --noEmit -p tsconfig.json
npx eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts
npm run test
```

Resumo dos resultados:
- Backend: suite completa — **679 testes, 0 falhas, 1 skip** (inclui os 6 testes novos de
  `test_portal_clinica_agendamentos.py`). Nenhuma regressao nos testes de portal/agenda/financeiro
  existentes.
- Frontend: `tsc --noEmit` sem erros; `eslint` sem erros/avisos nos arquivos alterados;
  `npm run test` — 3 suites vitest / 22 testes ok; 2 falhas pre-existentes e nao relacionadas
  (`lib/api-error.test.ts`, `lib/atendimento-form-merge.test.ts`, `ERR_MODULE_NOT_FOUND` do
  runner nativo `node --test`, mesma causa ja registrada em
  `docs/specs/agenda-reserva-mensagem-edicao/verify.md`).
- Boot do `next dev` local + `GET /clinica-parceira` retornou 200, HTML sem marcadores de erro.

## 3) Testes manuais

- **Nao executados neste ambiente** (sem backend/DB/autenticacao real disponiveis neste sandbox).
- Pendente para quem revisar (local ou stage):
  1. Logar no portal como uma clinica com agendamentos futuros em Agendado/Reservado/Confirmado.
  2. Confirmar que a lista mostra so os agendamentos daquela clinica, com pet/tutor/servico
     corretos.
  3. Clicar em "Cancelar" -> confirmar -> checar que o status muda para Cancelado na agenda
     interna e que some da lista do portal.
  4. Confirmar, pela agenda interna, que a nota `[Portal] Cancelado pela clinica parceira...`
     aparece nas observacoes do agendamento.
  5. Confirmar que um agendamento "Em atendimento" aparece na lista sem botao de cancelar.

## 4) QA em stage (2026-08-08) - achado e correcao

Ao testar em stage (clinica real, portal logado), o bloco "Exames liberados" (pre-existente,
`listar_exames_clinica_portal`) passou a retornar "Internal Server Error" intermitente. Nao foi
possivel reproduzir localmente (testado em SQLite e Postgres real, com e sem exame/laudo liberado
seedado) - a consulta sempre funcionou isoladamente. Hipotese mais provavel: o stage roda SQLite
(`backend/fortcordis.db`, confirmado no log de deploy) sem modo WAL, e esta entrega passou a
disparar 3 requisicoes simultaneas ao backend no carregamento da pagina do portal
(`loadDashboard` + `loadAgendamentos` + `loadFinanceiro`, antes era so a primeira) - um cenario
classico de "database is locked" sob concorrencia em SQLite.

Mitigacao aplicada: as 3 chamadas agora rodam em sequencia (nao mais `Promise.all`/disparo
paralelo) em `PortalClinicaWorkspace.tsx`, reduzindo a carga concorrente que esta entrega
introduziu. Isso nao foi confirmado como a causa raiz exata (sem acesso ao log do backend em
stage para ver o traceback) - fica como item a confirmar/revisitar se o erro persistir. Se
confirmado "database is locked", a correcao mais robusta seria habilitar modo WAL no SQLite
(`PRAGMA journal_mode=WAL`) em `app/db/database.py` - mudanca maior, fora do escopo desta
correcao pontual.

## 5) Regressao e riscos residuais

- Risco residual 1: nao ha, no seed de teste atual, um agendamento com status "Em atendimento"
  exercitando o caminho `pode_cancelar=false` end-to-end (a logica e testada indiretamente pelo
  calculo de `AGENDA_PORTAL_STATUSES_CANCELAVEIS`, mas sem um teste dedicado a esse status
  especifico). Baixo risco (mesma lista/formula usada para "Realizado", que tem teste dedicado).
- Risco residual 2: decisoes de escopo (quais status sao cancelaveis, se "outras acoes" ficariam
  de fora) foram assumidas pelos defaults recomendados, sem confirmacao explicita do usuario
  (`intent.md`, secao 7) — revisar antes do release.
- Risco residual 3: cancelamento pelo portal nao dispara notificacao em tempo real para a agenda
  interna (`_notificar_agenda_update` nao foi reaproveitado, para reduzir o acoplamento com
  `agenda.py` nesta primeira entrega); a equipe ve a mudanca apenas ao recarregar/atualizar a
  agenda. Considerar como proxima melhoria caso vire ponto de atrito operacional.
- Risco residual 4: import cruzado de uma funcao "privada" (`_adquirir_lock_escrita_agenda`) de
  `agenda.py` para `portal.py` — funciona e foi testado, mas nao ha um modulo compartilhado
  formal para primitivas de escrita da agenda (os demais modulos `app/core/agenda_*.py` cobrem
  outras responsabilidades). Registrado como debito tecnico; ver `NEXT_STEPS.md`.
- Nenhuma regressao detectada nas suites existentes (backend completo + frontend).

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado ainda — pendente de: (a) confirmacao do usuario sobre as decisoes de escopo
      registradas em `intent.md` secao 7, e (b) QA manual com dados reais (ver secao 3).
