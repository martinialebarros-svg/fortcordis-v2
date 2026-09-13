# Verify - receita-emitida-em-fuso-operacional

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: implementado e verificado localmente, inclusive contra Postgres real.
Verificacao manual em stage e a conferencia da prescricao #42 em producao
seguem pendentes.

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 / CA-001 | aceitacao | `test_emitida_em_e_servido_em_horario_operacional` - valor aware `2026-09-11T03:44:46+00:00` sai da API como `2026-09-11T00:44:46-03:00` | ok |
| RF-006 | aceitacao | `test_aviso_de_receita_emitida_usa_hora_local` - a mensagem do 409 traz "11/09/2026 00:44" e nao contem "03:44" | ok |
| RF-004 / CA-003 | aceitacao | migracao validada em Postgres 16: registro gravado pelo schema antigo passa a representar o instante correto (secao 3) | ok local; falta conferir #42 em producao |
| CA-004 | nao funcional | migracao executada duas vezes seguidas em Postgres: segunda vira no-op pelo teste de tipo; chamada com `dialect="sqlite"` nao altera nada | ok |
| RF-005 / CA-005 | funcional | `AtendimentoReceitasBar.test.tsx` - "distingue receita emitida de rascunho" segue passando; o teste de flag usa nulo, nao o formato | ok |
| CA-006 | funcional | suite completa do backend sem regressao (1290 passed) | ok |
| RF-002, RF-003 / CA-002 | aceitacao | depende de tela: verificar em stage | pendente |
| Regressao | teste negativo | com a correcao revertida, os dois testes falham com exatamente o defeito relatado (secao 4) | ok |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/ -q
```

```bash
cd frontend && npm run lint && npx vitest run && npm run build
```

- Backend: **1290 passed, 7 skipped, 278 subtests**. Dois testes novos.
- Frontend: `eslint --max-warnings=0` limpo, **284 testes em 41 arquivos**,
  `next build` concluido.

**`tsc --noEmit` acusa 3 erros em `app/whatsapp-stage/AppointmentQueue.test.tsx`
(TS2322), anteriores a esta entrega e fora do seu diff** - ultimo commit a
tocar o arquivo foi `31e1bb30`. Filtrando esse arquivo, o typecheck fica limpo.
Vale registrar que o `quality-gate` do CI roda apenas `npm run lint` no
frontend, sem `tsc`, e por isso nao sinaliza esse erro - foi o que permitiu a
quebra chegar ate aqui.

## 3) Migracao verificada contra Postgres real

Instancia Postgres 16.13 descartavel, sessao em `TimeZone='UTC'` para
reproduzir producao. Roteiro em
`scratchpad/testa_migracao_84.py` (nao versionado).

| Etapa | Resultado |
| --- | --- |
| Schema antigo (`TIMESTAMP`) + gravacao aware de 22:48-03:00 | guarda `2026-09-11 01:48:52.278245`, sem fuso - defeito reproduzido |
| Migracao, 1a execucao | tipo vira `timestamp with time zone`; valor passa a representar `2026-09-10T22:48:52-03:00` |
| Migracao, 2a execucao | valor inalterado - o teste de tipo faz virar no-op |
| Chamada com `dialect="sqlite"` | nenhuma alteracao |

Por que o teste de tipo importa para a idempotencia: `AT TIME ZONE 'UTC'`
aplicado a um `timestamptz` produz `timestamp` naive. Sem a guarda, reexecutar
a migracao deslocaria os valores em vez de ser inofensivo.

**Atencao ao `TimeZone` da sessao.** A instancia local subiu com
`TimeZone=America/Fortaleza`; foi preciso forcar `UTC` para reproduzir o
defeito. O `USING ... AT TIME ZONE 'UTC'` so esta correto porque os valores de
producao foram gravados sob sessao UTC - o que a propria prescricao #42
comprova (03:44 gravado para uma emissao das 00:44 locais). Se em alguma base
isso nao valer, a migracao corrige para o fuso errado.

## 4) Teste negativo

Revertendo a correcao (voltando `_to_iso` e `_formatar_data_hora` sem
`_to_local_naive`), os dois testes novos falham:

```
AssertionError: '2026-09-11T03:44:46+00:00' != '2026-09-11T00:44:46-03:00'
AssertionError: '11/09/2026 00:44' not found in 'A receita 1 deste atendimento
foi emitida em 11/09/2026 03:44. ...'
```

A segunda linha e literalmente o texto que aparecia na tela. Confirma que os
testes cobrem o defeito relatado, e nao so a funcao auxiliar.

## 5) Por que os testes injetam o valor direto

Os dois testes atribuem um `datetime` aware em UTC ao objeto, sem ida ao banco.
E proposital: em SQLite a gravacao descarta o offset e guarda os numeros
locais, entao um teste que dependesse do round trip passaria **mesmo com o
defeito vivo**. Injetando o aware, o teste exercita exatamente o que o Postgres
devolve depois da migracao, e vale nos dois dialetos.

## 6) Pendente

- Verificacao manual em stage (RF-002, RF-003 / CA-002): emitir uma receita
  anotando a hora do relogio e conferir o aviso na hora e **depois de
  recarregar** - o valor otimista do frontend usa `toISOString()` e sempre
  mostrou a hora certa; o defeito so aparecia apos o reload.
- Producao, apos a promocao: conferir a prescricao #42, hoje em
  `2026-09-11T03:44:46.116954`, que deve passar a exibir 00:44 de 11/09/2026.
- Stage nao tem receita emitida no momento: o atendimento #16, que servia de
  evidencia, foi removido em 2026-09-11. O roteiro precisa recriar o cenario.
