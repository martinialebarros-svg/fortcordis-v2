# Intent - receita-emitida-em-fuso-operacional

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema atual

O aviso "Esta receita foi emitida em ..." mostra hora errada, 3 horas a frente.
Uma receita emitida as 22:48 locais aparece como "11/09/2026 01:48" - dia
seguinte, inclusive. Em documento clinico que vai para a mao do tutor, data
errada nao e cosmetico.

O desvio foi observado durante a verificacao de
`atendimento-continuidade-pos-alta` e registrado na secao 5 daquele `verify.md`
como observacao fora de escopo. Esta spec e o fechamento daquele item.

### Cadeia completa do defeito

1. **Gravacao.** `prescricao.emitida_em = datetime.now(ATENDIMENTO_LOCAL_TZ)`
   (`backend/app/api/v1/endpoints/atendimento.py:2124`) grava um datetime
   *aware* em UTC-3.
2. **Schema.** A coluna foi criada pela migracao `20260910_83` como
   `TIMESTAMP` puro - em Postgres, `timestamp without time zone`. O modelo
   declara `emitida_em = Column(DateTime(timezone=True))`
   (`backend/app/models/atendimento_clinico.py:258`). **Modelo e schema
   divergem**, e o schema e quem manda.
3. **Efeito no Postgres.** Ao gravar um valor aware numa coluna naive, o
   Postgres converte para UTC e descarta o fuso. As 22:48-03:00 viram 01:48
   sem fuso.
4. **Serializacao.** `_to_iso` (`atendimento.py:744`) so chama `.isoformat()`.
   O valor sai naive: `"2026-09-11T01:48:52.278245"`, sem offset. Os demais
   horarios do modulo passam por `_to_operational_iso`, que normaliza para
   UTC-3.
5. **Render.** `parseOperationalDate`
   (`frontend/lib/atendimento-utils.ts:23`) trata string **sem fuso como
   horario operacional local** - e o contrato da casa. Recebendo numeros de
   UTC rotulados como locais, mostra 01:48.

### Inconsistencia que mascarou o defeito

Ao emitir, o frontend preenche `emitida_em` otimisticamente com
`new Date().toISOString()` (`frontend/app/atendimento/page.tsx:6511`), que
carrega `Z`. Nesse instante o aviso mostra a **hora certa**. O erro so aparece
depois de recarregar, quando o valor vem do servidor. O mesmo campo mostra duas
horas diferentes conforme a pagina foi recarregada ou nao.

## 2) Objetivo

`emitida_em` volta a obedecer o mesmo contrato de fuso do resto do modulo: o
que a API entrega representa horario operacional (UTC-3), e a tela mostra a
hora em que a receita foi realmente emitida - antes e depois de recarregar.

## 3) Nao objetivos

- Nao revisar o fuso dos demais campos do modulo, que ja passam por
  `_to_operational_iso`.
- Nao introduzir suporte a multiplos fusos ou a horario de verao.
  `ATENDIMENTO_LOCAL_TZ` e offset fixo UTC-3 (America/Fortaleza, sem DST) e
  continua assim.
- Nao mexer no `mergeAutoSavedFormState`, o outro item aberto da secao 5 do
  `verify.md` daquela entrega.

## 4) Contexto e restricoes

- Producao e Postgres; o SQLite local tem drift conhecido de schema. Qualquer
  migracao precisa de guarda por dialeto, no padrao ja usado em
  `backend/migrations/versions/`.
- **Volume afetado hoje: 1 registro em producao.** Varredura pela API nos 61
  atendimentos existentes em 2026-09-11 encontrou uma unica receita com
  `emitida_em` preenchido (atendimento #42, prescricao #42,
  `2026-09-11T03:44:46.116954` - ou seja 00:44 locais, emitida logo apos o
  deploy de hoje). Em stage nao ha nenhum: o atendimento #16, que servia de
  evidencia, foi removido em 2026-09-11.
- A janela e boa justamente por isso: a coluna nasceu nesta semana e quase nao
  tem dado. Quanto mais receita for emitida, mais caro fica o backfill.
- `_to_operational_iso` ja aceita os dois casos (naive vira local, aware e
  convertido), entao ele e o serializador certo em qualquer desenho escolhido.
- `AtendimentoReceitasBar.test.tsx` fixa `emitida_em: "2026-09-01T15:00:00"`
  (naive) - o teste vai precisar refletir o contrato novo.
