# Spec - fiscal-numero-sequence-for23

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Substituir estrategia de geracao de numero fiscal por controle transacional dedicado de sequencia anual.

## Requisitos funcionais

- RF-001: cada nova nota fiscal deve receber numero unico e monotonicamente crescente por ano.
- RF-002: concorrencia de criacao simultanea nao deve gerar duplicidades de numero.
- RF-003: migration deve preservar continuidade de numeracao considerando dados existentes.
- RF-004: em ambiente sem migration FOR-23, sistema deve manter operacao via fallback legado.

## Requisitos tecnicos

- RT-001: tabela `fiscal_numero_sequencias` com PK em `ano` e coluna `ultimo_numero`.
- RT-002: incremento atomico por `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`.
- RT-003: backfill por parsing de `notas_fiscais.numero` no padrao `NFO-YYYY-NNNNN`.
- RT-004: compatibilidade de startup local com schema-compat (`checkfirst`).

## Criterios de aceitacao

- CA-001: migration cria/atualiza `fiscal_numero_sequencias` e faz backfill correto.
- CA-002: criacoes concorrentes produzem numeros unicos sem colisao.
- CA-003: contador da sequencia reflete a quantidade gerada no ano corrente.
- CA-004: sem tabela de sequencia, geracao fiscal continua funcional via fallback legado.
