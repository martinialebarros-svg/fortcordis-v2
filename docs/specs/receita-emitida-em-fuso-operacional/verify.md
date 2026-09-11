# Verify - receita-emitida-em-fuso-operacional

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: **nao verificado** - implementacao nao iniciada

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 | funcional | serializacao com offset nos 4 pontos | pendente |
| RF-002 | funcional | aviso mostra a hora local da emissao | pendente |
| RF-003 | aceitacao | mesma hora antes e depois do reload | pendente |
| RF-004 | aceitacao | registro existente exibido corretamente | pendente |
| RF-005 | funcional | rotulo "Emitida"/"Rascunho" inalterado | pendente |
| CA-001 | aceitacao | emissao as HH:MM devolve HH:MM com `-03:00` | pendente |
| CA-002 | aceitacao | hora estavel entre render otimista e servidor | pendente |
| CA-003 | aceitacao | prescricao #42 de producao passa a exibir 00:44 de 11/09/2026 | pendente |
| CA-004 | nao funcional | migracao idempotente em SQLite e Postgres | pendente |
| CA-005 | funcional | receita nao emitida segue nula e "Rascunho" | pendente |
| CA-006 | funcional | guard de receita emitida sem 409 novo | pendente |

## 2) Evidencia do defeito, coletada antes da correcao

Serve de linha de base: depois da correcao, os mesmos pontos devem mudar.

- **Producao, 2026-09-11.** Varredura pela API nos 61 atendimentos: uma unica
  receita com `emitida_em` preenchido - atendimento #42, prescricao #42,
  valor `"2026-09-11T03:44:46.116954"`, sem offset. Emitida por volta das 00:44
  locais, logo apos o deploy do dia. Desvio de +3h confirmado.
- **Contrato do frontend.** `parseOperationalDate`
  (`frontend/lib/atendimento-utils.ts:23`) anexa o offset operacional a toda
  string sem fuso. Logo, `"...T03:44:46"` e renderizado como 03:44 local.
- **Divergencia entre dialetos.** Reproduzido em 2026-09-11 com SQLAlchemy
  sobre SQLite descartavel: gravando `datetime.now(ATENDIMENTO_LOCAL_TZ)` as
  10:45 locais, o SQLite guarda `2026-09-11 10:45:22.612942` (numeros locais,
  offset descartado) e le de volta naive. O Postgres guarda o equivalente em
  UTC. Mesmo codigo, resultado diferente.

## 3) Roteiro de verificacao planejado

Backend/automatizado:

1. Emitir receita com o relogio em hora local conhecida; conferir que a API
   devolve offset `-03:00` e a hora certa.
2. Regressao: valor gravado no schema antigo (UTC naive) e servido como o
   instante local correto depois da migracao.
3. Migracao rodada duas vezes seguidas, em SQLite e em Postgres.

**A suite de fuso precisa rodar contra Postgres.** Em SQLite ela passa mesmo
com o defeito vivo - ver secao 3 da `spec.md`. O `migration-tests` do CI roda
so em SQLite, entao esta parte fica fora dele, como ja aconteceu com a NFR-005
da entrega anterior.

Manual em stage:

4. Emitir uma receita anotando a hora do relogio; conferir o aviso na hora e
   depois de recarregar (RF-003 so aparece com o reload).
5. Conferir `emitida_em` na API e no `localStorage`, como no CA-013 da entrega
   anterior.

Producao, apos a promocao:

6. Conferir a prescricao #42 - deve exibir 00:44 de 11/09/2026.

## 4) Riscos a observar na verificacao

- Se o `TimeZone` da sessao do Postgres em producao nao for UTC, o `USING ...
  AT TIME ZONE 'UTC'` da migracao corrige para o fuso errado. Conferir o
  registro #42 antes e depois e a trava contra isso.
- O ambiente local nao reproduz o defeito; concluir a partir dele daria falso
  positivo.
