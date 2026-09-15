# Plan - receita-emitida-em-fuso-operacional

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: draft - nao iniciado

Desenho escolhido: Opcao A da `spec.md` - coluna vira `TIMESTAMPTZ` em
Postgres, gravacao segue aware, leitura passa por `_to_operational_iso`.

## 1) Sequencia de fases

- Fase 1 (DB): migracao que converte `prescricoes_clinicas.emitida_em` para
  `timestamptz` em Postgres, interpretando o valor atual como UTC.
- Fase 2 (backend): trocar `_to_iso` por `_to_operational_iso` nos 4 pontos de
  serializacao de `emitida_em`.
- Fase 3 (frontend): alinhar o valor otimista e os testes ao contrato.
- Fase 4 (testes/verificacao): suite + verificacao em stage, obrigatoriamente
  contra Postgres.

Cabe em um PR unico contra `stage`: a mudanca e pequena e as fases nao sao
entregaveis isoladamente - migrar sem trocar o serializador deixa a tela igual.

## 2) Tarefas por fase

### Fase 1 - migracao

- [ ] T1.1 criar `backend/migrations/versions/20260911_84_emitida_em_timestamptz.py`
      no padrao de `20260910_83`: idempotente, com guarda de dialeto.
- [ ] T1.2 caminho Postgres:
      `ALTER TABLE prescricoes_clinicas ALTER COLUMN emitida_em TYPE timestamptz USING emitida_em AT TIME ZONE 'UTC'`.
      O `USING` reinterpreta o valor gravado como UTC, que e o que ele de fato
      e, e corrige o registro existente na mesma operacao.
- [ ] T1.3 caminho SQLite: **nao fazer nada**. O SQLite ja guarda os numeros
      locais (ver secao 3 da `spec.md`), entao converter seria introduzir o
      desvio que nao existe la. Documentar isso no docstring da migracao - e
      contraintuitivo e um leitor futuro vai querer "corrigir".
- [ ] T1.4 idempotencia: checar o tipo atual antes de alterar
      (`information_schema.columns.data_type`), para a segunda execucao virar
      no-op.
- Criterio de conclusao: migracao roda duas vezes seguidas sem erro em SQLite e
  em Postgres; no Postgres o tipo final e `timestamp with time zone` e o
  registro existente passa a representar o instante correto.
- Risco: se o valor gravado nao for UTC em alguma base (por `TimeZone` de
  sessao diferente), o `USING` corrige para o fuso errado. Mitigacao: conferir
  o registro de producao antes e depois - a prescricao #42 deve sair de
  `03:44:46` para `2026-09-11T00:44:46-03:00`.
- Rollback: `ALTER COLUMN ... TYPE timestamp USING emitida_em AT TIME ZONE 'UTC'`
  devolve o estado anterior sem perda.

### Fase 2 - backend

- [ ] T2.1 trocar `_to_iso` por `_to_operational_iso` em `emitida_em` nas 4
      ocorrencias de `backend/app/api/v1/endpoints/atendimento.py`
      (linhas 2087, 2114, 2437, 6074).
- [ ] T2.2 confirmar que a gravacao em `atendimento.py:2124` segue
      `datetime.now(ATENDIMENTO_LOCAL_TZ)` - com a coluna timestamptz, gravar
      aware passa a ser o caminho correto, nao mais o que causa o desvio.
- [ ] T2.3 verificar se `emitida_em` alimenta o PDF ou o contrato legado de
      `prescricao`; se sim, aplicar o mesmo serializador.
- Criterio de conclusao: `GET /atendimentos/{id}` devolve `emitida_em` com
  offset `-03:00`.

### Fase 3 - frontend

- [ ] T3.1 revisar o valor otimista em `frontend/app/atendimento/page.tsx:6511`
      (`new Date().toISOString()`). Com `Z` explicito ele ja renderiza certo;
      decidir entre manter e padronizar para o mesmo formato do servidor. O
      requisito e RF-003: mesma hora antes e depois do reload.
- [ ] T3.2 atualizar `AtendimentoReceitasBar.test.tsx`, que hoje fixa
      `emitida_em: "2026-09-01T15:00:00"` (naive), para o contrato com offset.
- [ ] T3.3 nenhuma mudanca esperada em `formatDate` /
      `parseOperationalDate` - eles ja tratam offset explicito corretamente.
      Se precisar mexer neles, o desenho esta errado.

### Fase 4 - testes e verificacao

- [ ] T4.1 teste de backend: receita emitida devolve `emitida_em` com offset e
      com a hora local correta.
- [ ] T4.2 teste de regressao do defeito: um valor UTC gravado no schema antigo
      passa a ser servido como o instante local correto.
- [ ] T4.3 **executar a suite de fuso contra Postgres**, nao so SQLite. Em
      SQLite o teste passa com o defeito vivo (secao 3 da `spec.md`), entao um
      teste que so roda no CI atual nao prova nada sobre esta correcao.
- [ ] T4.4 verificacao manual em stage: emitir uma receita, anotar a hora do
      relogio, conferir o aviso antes e depois de recarregar.
- [ ] T4.5 conferir a prescricao #42 em producao depois da promocao.

## 3) Ordem de execucao e dependencias

Fase 1 antes da Fase 2: trocar o serializador antes de converter a coluna
produziria o pior resultado possivel - `_to_operational_iso` rotularia o valor
UTC como local e a hora errada ganharia um offset de aparencia correta,
tornando o defeito mais dificil de enxergar. As fases 3 e 4 dependem das duas.

## 4) Pontos de atencao

- O ambiente de desenvolvimento nao reproduz o defeito. Verificacao que nao
  passe por Postgres nao vale.
- A janela e favoravel: 1 registro afetado em producao hoje. Cada receita
  emitida antes da correcao aumenta o custo do backfill.
- `emitida_em` e usado como flag ("Emitida" vs "Rascunho") alem de data. O
  tipo muda, mas `is None` continua sendo o teste de flag - CA-005.
