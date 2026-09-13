# Spec - receita-emitida-em-fuso-operacional

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: implementado; verificacao em stage pendente

## 1) Escopo

Corrigir o fuso de `prescricoes_clinicas.emitida_em` na ponta de gravacao e na
de leitura, de modo que a hora exibida no aviso de receita emitida seja a hora
real da emissao. Inclui o unico registro ja gravado com desvio.

## 2) Requisitos funcionais

- RF-001: a API entrega `emitida_em` em horario operacional (UTC-3),
  explicitamente marcado com offset, em todos os 4 pontos de serializacao
  (`atendimento.py` linhas 2087, 2114, 2437 e 6074).
- RF-006: o texto do aviso de receita emitida, que vem pronto do backend via
  `_formatar_data_hora` (linhas 2080 e 2108), tambem mostra hora local. Achado
  durante a implementacao: sao 2 pontos alem dos 4 de serializacao, e sao
  justamente os que produzem a string que o vet le na tela.
- RF-002: o aviso "Esta receita foi emitida em ..." mostra a hora local da
  emissao.
- RF-003: a hora exibida e a mesma antes e depois de recarregar a pagina - o
  valor otimista do frontend e o valor do servidor convergem.
- RF-004: o registro ja gravado com desvio passa a exibir a hora correta.
- RF-005: o rotulo "Emitida" vs "Rascunho" continua dependendo so de
  `emitida_em` ser nulo ou nao, sem mudanca de comportamento.

## 3) Decisao de armazenamento

O nucleo do defeito e que **modelo e schema discordam**: o modelo declara
`DateTime(timezone=True)`, a migracao criou `TIMESTAMP` naive. Trocar so o
serializador nao resolve - `_to_operational_iso` interpreta naive como
**local**, e o que esta gravado e **UTC**. Aplicado sozinho, ele rotularia
03:44 como "03:44-03:00": continuaria a hora errada, agora com offset que
parece correto. Esta e a armadilha principal desta correcao.

### Por que isso nunca apareceu no dev local

Os dois bancos se comportam de forma **diferente** com o mesmo codigo. Gravando
o mesmo `datetime.now(ATENDIMENTO_LOCAL_TZ)`:

| Banco | Grava | Le de volta | Exibicao |
| --- | --- | --- | --- |
| SQLite (dev, `migration-tests`) | `10:45:22` - hora local, offset descartado | naive local | correta |
| Postgres (stage, producao) | converte para UTC | naive UTC | 3h a frente |

Verificado em 2026-09-11 com SQLAlchemy sobre SQLite descartavel. O dialeto
SQLite guarda os numeros do relogio local e joga fora o offset; o Postgres
converte para UTC. Por isso o defeito e invisivel no ambiente de
desenvolvimento e no CI de migracao, que roda so em SQLite
(`DATABASE_URL: sqlite:///./fortcordis-ci.db`).

**Consequencia para a verificacao: teste que exercite fuso desta coluna so vale
em Postgres.** Em SQLite ele passa com o defeito vivo.

Duas saidas coerentes:

**Opcao A - alinhar o schema ao modelo. ESCOLHIDA em 2026-09-11.** Migracao converte a
coluna para `TIMESTAMPTZ` em Postgres
(`ALTER COLUMN emitida_em TYPE timestamptz USING emitida_em AT TIME ZONE 'UTC'`),
com guarda de dialeto porque o SQLite nao tem `ALTER COLUMN ... TYPE`. O
`USING` ja corrige o registro existente. A gravacao continua aware, a leitura
passa a `_to_operational_iso`.

- A favor: instante absoluto, sem ambiguidade; para de depender do `TimeZone`
  da sessao do Postgres, que e o que hoje define silenciosamente em que fuso o
  valor aterrissa; modelo e schema voltam a concordar.
- Contra: exige migracao com caminho diferente por dialeto.

**Opcao B - padronizar em naive local, como o resto do modulo.** Gravacao passa
a `_to_local_naive(datetime.now(ATENDIMENTO_LOCAL_TZ))`, leitura passa a
`_to_operational_iso`, e uma migracao de dados desloca em -3h o registro ja
gravado.

- A favor: mesma convencao dos demais campos do modulo (naive == local), sem
  `ALTER COLUMN`; funciona igual em SQLite e Postgres.
- Contra: guarda instante ambiguo e mantem o modelo declarando
  `timezone=True` sobre coluna naive - a mesma divergencia que causou o
  defeito, so que agora documentada.

## 4) Requisitos tecnicos

- RT-001: migracao aditiva e idempotente, com guarda por dialeto, no padrao de
  `backend/migrations/versions/20260910_83_*`.
- RT-002: rodar duas vezes seguidas sem erro, em SQLite e em Postgres.
- RT-003: nenhuma mudanca no contrato de `prescricao` legado nem no endpoint de
  PDF.
- RT-004: modelo e schema devem concordar ao fim da entrega; se a Opcao B for
  escolhida, ajustar a declaracao do modelo para refletir coluna naive.

## 5) Criterios de aceitacao

- CA-001: receita emitida as HH:MM locais retorna `emitida_em` com offset
  `-03:00` e hora HH:MM.
- CA-002: o aviso na tela mostra HH:MM - a mesma hora imediatamente apos
  emitir e depois de recarregar.
- CA-003: a prescricao #42 de producao, hoje em `2026-09-11T03:44:46.116954`,
  passa a exibir 00:44 de 11/09/2026.
- CA-004: migracao executada duas vezes seguidas e idempotente em SQLite e em
  Postgres.
- CA-005: receita nao emitida continua com `emitida_em` nulo e rotulo
  "Rascunho".
- CA-006: `_payload_altera_prescricao` e o guard de receita emitida seguem
  funcionando - a correcao nao pode disparar 409 onde nao havia.

## 6) Fora de escopo

- `mergeAutoSavedFormState` nao propagar `status` ao finalizar.
- Revisao de fuso dos demais campos do modulo.
