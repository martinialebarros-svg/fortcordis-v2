# Verify - receita-emitida-em-fuso-operacional

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: verificado. Local, contra Postgres real, em producao (prescricao #42,
secao 7) e em tela no stage (secao 8).

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 / CA-001 | aceitacao | `test_emitida_em_e_servido_em_horario_operacional` - valor aware `2026-09-11T03:44:46+00:00` sai da API como `2026-09-11T00:44:46-03:00` | ok |
| RF-006 | aceitacao | `test_aviso_de_receita_emitida_usa_hora_local` - a mensagem do 409 traz "11/09/2026 00:44" e nao contem "03:44" | ok |
| RF-004 / CA-003 | aceitacao | migracao validada em Postgres 16 (secao 3) e conferida em producao: a prescricao #42 passou a exibir 11/09/2026 00:44 (secao 7) | ok |
| CA-004 | nao funcional | migracao executada duas vezes seguidas em Postgres: segunda vira no-op pelo teste de tipo; chamada com `dialect="sqlite"` nao altera nada | ok |
| RF-005 / CA-005 | funcional | `AtendimentoReceitasBar.test.tsx` - "distingue receita emitida de rascunho" segue passando; o teste de flag usa nulo, nao o formato | ok |
| CA-006 | funcional | suite completa do backend sem regressao (1290 passed) | ok |
| RF-002, RF-003 / CA-002 | aceitacao | stage, atendimento #17, 2026-09-13 (secao 8): aviso mostra `13/09/2026, 09:03:57` antes e depois de recarregar | ok |
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

## 6) Pendencia anterior, fechada

A verificacao de tela em stage (RF-002, RF-003 / CA-002) estava aberta porque
dependia de emitir uma receita e conferir o aviso **depois de recarregar** - o
valor otimista do frontend usa `toISOString()` e sempre mostrou a hora certa, e
o defeito so aparecia apos o reload. O cenario tambem precisava ser recriado: o
atendimento #16, que servia de evidencia, foi removido em 2026-09-11.

Fechada em 2026-09-13 com o atendimento #17. Registro na secao 8.

## 7) Conferencia em producao (2026-09-13)

Feita apos a promocao `c88df7a6`, que aplicou a migracao `20260911_84`
(`[Migrations] OK 20260911_84` no run 34734702767).

| Checagem | Resultado |
| --- | --- |
| Tipo da coluna `prescricoes_clinicas.emitida_em` | `timestamp with time zone` |
| Migracao registrada em `schema_migrations` | `20260911_84` |
| Valor armazenado da prescricao #42 | `2026-09-11 03:44:46.116954+00` |
| `to_char(... AT TIME ZONE 'America/Fortaleza')` | `11/09/2026 00:44` |
| `_to_operational_iso` sobre o valor lido do banco | `2026-09-11T00:44:46.116954-03:00` |
| `_formatar_data_hora(_to_local_naive(...))` (texto do aviso 409) | `11/09/2026 00:44` |

O valor gravado continua sendo o mesmo instante; o que mudou e que a coluna
agora carrega o fuso, entao o `03:44` deixou de ser servido como se fosse hora
local. Os dois ultimos itens exercitam o caminho real da API contra o dado de
producao, nao um valor injetado -- e batem com o esperado pelos testes
(`2026-09-11T00:44:46-03:00` e `11/09/2026 00:44`, sem `03:44`).

## 8) Verificacao de tela em stage (2026-09-13)

Atendimento #17, paciente Aberaldo, prescricao #13 (`sequencia` 1). Navegador em
`America/Fortaleza` (UTC-3), o mesmo fuso operacional.

O aviso de RF-002 nao depende do 409: ele e renderizado por
`AtendimentoReceitasBar.tsx:81` sempre que a receita ativa tem `emitida_em`.
Basta selecionar a aba da receita emitida.

| Momento | Origem do valor exibido | Aviso na tela |
| --- | --- | --- |
| Antes do reload | instancia da pagina carregada 08:59:15, onde a emissao ocorreu as 09:03:57 - caminho otimista | `Esta receita foi emitida em 13/09/2026, 09:03:57` |
| Depois do reload | carregamento novo as 09:17:10, valor vindo do servidor | `Esta receita foi emitida em 13/09/2026, 09:03:57` |

Referencias conferidas no mesmo instante:

- `GET /api/v1/atendimentos/17` devolve
  `"emitida_em": "2026-09-13T09:03:57.877625-03:00"` - offset presente, hora
  local.
- Relogio local na emissao: 09:03. Com o defeito vivo, o valor apos o reload
  seria `12:03`.

Que a emissao ocorreu **dentro** da instancia pre-reload foi confirmado por
`performance.timeOrigin` (08:59:15) contra o `emitida_em` (09:03:57) - sem isso,
a leitura "antes" seria ja o valor do servidor e RF-003 nao teria sido
exercitado.

### Desvio do roteiro, e por que nao invalida

O roteiro previa "recarregar a pagina". Recarregar `/atendimento` **perde o
atendimento**: a rota sem parametro abre formulario vazio, porque o restore le
`fortcordis:atendimento:draft:v1` (chave global, pre-primeiro-save) e nao a
chave de backup `...:17`. O segundo carregamento foi feito por
`/atendimento?atendimento_id=17` (`page.tsx:2187`), que e carregamento novo
buscando do servidor - a condicao que RF-003 exige. O que muda e so o caminho de
navegacao.

Fica o registro de que recarregar um atendimento aberto pela agenda derruba o
contexto. Nao e desta spec, e nao foi investigado alem disso.

### Observacao retratada (2026-09-13)

Esta secao afirmava que `created_at` da prescricao, por voltar como
`2026-09-13T12:06:18.775212+00:00`, faria alguma tela mostrar 3 horas a mais.
**A afirmacao estava errada e fica retratada aqui.**

`created_at` e `DateTime(timezone=True)` no modelo, igual ao `emitida_em`, e e
serializado por `_to_iso`, que preserva o offset. No frontend,
`parseOperationalDate` (`atendimento-utils.ts:28`) testa se a string traz fuso
explicito -- `Z` ou `+-HH:MM` -- e so aplica o offset operacional quando **nao**
traz. Com offset presente, converte pelo instante:

```
2026-09-13T12:06:18.775212+00:00  ->  13/09/2026, 09:06:18
```

Todos os pontos que exibem `created_at` no modulo passam por `formatDate`:
anexos (`AtendimentoExamesSection`, `AtendimentoDocumentosSection`,
`AttachmentPreviewModal`), historico de ajustes (`page.tsx:7469`) e o rotulo de
autosave (`page.tsx:6905`/`6908`, alimentado por `updated_at || created_at`).

Por que o erro passou: o defeito real desta spec era a **ausencia** de offset --
`2026-09-11T03:44:46`, sem fuso, que o JS le como hora local e exibia 03:44 no
lugar de 00:44. Um timestamp **com** offset e inequivoco, e foi confundido com o
primeiro caso so por estar em UTC. Havia inclusive evidencia contraria na
propria tela: o rotulo "Sincronizado" mostrava a hora local certa em stage.

Conferido com o responsavel em 2026-09-13: nenhuma hora errada foi observada em
tela alguma.
