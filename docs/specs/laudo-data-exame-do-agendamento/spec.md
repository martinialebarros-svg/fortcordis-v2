# Spec - laudo-data-exame-do-agendamento

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: approved

## 1) Escopo funcional

Ajustar o default do campo de data de realizacao nos fluxos de criacao de laudo
a partir da agenda:

- `/laudos/eletrocardiograma/upload` (upload de PDF de exame): quando a URL
  traz `agendamento_id`, o default passa a ser a data do agendamento; sem
  `agendamento_id`, permanece a data do dia.
- `/laudos/novo` (ecocardiograma e pressao arterial): normalizar a data vinda
  do agendamento com `calendarDateInput` e usar `inicio` como fallback quando
  `data` vier vazia.

Em ambos os casos o campo continua livre para edicao manual.

## 2) Requisitos funcionais (RF)

- RF-001: em `/laudos/eletrocardiograma/upload?agendamento_id=<id>`, apos o
  carregamento de `GET /agenda/{id}`, "Data de realizacao" exibe a data do
  agendamento, e nao a data do dia.
- RF-002: na mesma pagina sem `agendamento_id`, "Data de realizacao" nasce com
  a data operacional do dia (America/Fortaleza), como hoje.
- RF-003: se `GET /agenda/{id}` falhar, o campo cai para a data do dia em vez
  de ficar vazio, e a mensagem de erro de contexto continua sendo exibida.
- RF-004: a data do agendamento e lida de `data` e, so quando ausente, de
  `inicio`, ambos normalizados por `calendarDateInput`.
- RF-005: o campo permanece editavel; um valor ja digitado pelo usuario nao e
  sobrescrito pela resposta do agendamento.
- RF-006: em `/laudos/novo` com `agendamento_id`, `data_exame` recebe
  `calendarDateInput(agendamento.data || agendamento.inicio)`, caindo para o
  valor anterior e depois para a data do dia.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): nenhuma chamada de rede nova; apenas a ordem de
  preenchimento do estado muda.
- NFR-002 (seguranca/permissoes): sem mudanca de permissao; o payload enviado
  ao backend continua o mesmo (`data_exame` do formulario).
- NFR-003 (fuso): datas continuam tratadas como data-calendario via
  `@/lib/calendar-date`, sem introduzir `new Date()` cru.

## 4) Contratos tecnicos

### API

- Endpoint: nenhum alterado. Consome `GET /agenda/{agendamento_id}` e
  `POST /laudos/eletrocardiograma/upload-pdf` como hoje.
- Metodo: n/a.
- Payload: inalterado.
- Resposta: inalterada.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- `frontend/app/laudos/eletrocardiograma/upload/page.tsx`
  - efeito de montagem so semeia a data do dia quando o contexto inicial nao
    tem `agendamento_id`;
  - efeito do agendamento aplica `toDateInput(item.data || item.inicio)`;
  - ramo de erro do agendamento semeia a data do dia.
- `frontend/app/laudos/novo/page.tsx`
  - `preencherDadosDoAgendamento` normaliza a data com `calendarDateInput` e
    aceita `inicio` como fallback.

## 5) Criterios de aceitacao (CA)

- CA-001: abrir o upload de exame por um agendamento de data passada (ex.:
  04/09) mostra 04/09 em "Data de realizacao".
- CA-002: abrir o upload de exame direto pelo menu de Laudos (sem agendamento)
  mostra a data de hoje.
- CA-003: com `agendamento_id` invalido ou API fora, o campo mostra a data de
  hoje e a pagina exibe "Nao foi possivel carregar o contexto do agendamento."
- CA-004: em qualquer um dos casos, alterar a data manualmente funciona e o
  valor digitado e o que vai no envio.

## 6) Fora de escopo

- Fluxo de ultrassonografia abdominal (ja correto).
- Derivar data de exame a partir de `atendimento_id`.
- Bloquear ou validar divergencia entre a data digitada e a data agendada.
