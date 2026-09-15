# Plan - atendimento-timeline-recente

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (backend): inverter ordenacao de anos/eventos em
  `_montar_timeline_paciente`; atualizar docstring; adicionar teste de
  regressao para a nova ordem.
- Fase 2 (frontend): `TIMELINE_EVENTO_META` + render do card de
  evento com icone/badge por tipo.
- Fase 3 (verificacao): `tsc`/`build`, pytest, verificacao end-to-end
  via preview local, revisao adversarial, `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `backend/.../atendimento.py`, `_montar_timeline_paciente`:
  `sorted(events, ..., reverse=True)`; `anos_reais = sorted((y for y
  in grouped if y != "Sem data"), reverse=True)`; `ordered_years =
  anos_reais + (["Sem data"] if "Sem data" in grouped else [])`.
- [x] T1.2 Atualizar docstring da funcao (mencionar "mais recente para
  o mais antigo").
- [x] T1.3 `backend/tests/test_atendimento_timeline_limitada.py`: novo
  teste `test_anos_e_eventos_em_ordem_decrescente` (anos e eventos
  dentro de cada ano em ordem decrescente).
- Criterio de conclusao: os 4 testes do arquivo passam
  (`pytest tests/test_atendimento_timeline_limitada.py`).
- Risco: baixo - so a ordem de listas ja calculadas, sem mudanca de
  schema/contrato (o formato de cada evento e do grupo continua o
  mesmo).

### Fase 2

- [x] T2.1 `page.tsx`: `TIMELINE_EVENTO_META` (6 entradas, reaproveita
  icones lucide-react ja importados: `ClipboardPlus`, `Clock3`,
  `FileUp`, `CheckCircle2`, `Paperclip`, `FileText` - nenhum import
  novo) + `TIMELINE_EVENTO_META_PADRAO` (fallback com `History`, ja
  importado).
- [x] T2.2 `page.tsx`, render do card de evento: marcador circular
  colorido com icone + badge de texto colorido com o rotulo, no lugar
  do texto uppercase cinza do `evento.tipo` bruto.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, 1 arquivo, sem mudanca de contrato/API, sem
  novo import de icone.

### Fase 3

- [x] T3.1 `pytest tests/test_atendimento_timeline_limitada.py` (4/4)
  e `pytest tests/ -k "atendimento or timeline"` (158/158, sem
  regressao em outros testes).
- [x] T3.2 `npx tsc --noEmit` e `npm run build` no worktree - ambos
  limpos.
- [x] T3.3 Verificacao end-to-end via preview local: dados sinteticos
  inseridos no banco local copiado (paciente "celine", eventos
  espalhados em 2024/2025/2026, multiplos tipos no mesmo mes de 2026)
  - `fetch()` direto ao endpoint `/api/v1/atendimentos/paciente/9/
  historico` (mesma rota que o frontend consome) confirmou: anos
  `["2026", "2025", "2024"]` (decrescente) e eventos dentro de 2026 em
  ordem decrescente (`2026-02-28` -> `2026-01-05`), cobrindo 5 dos 6
  tipos de evento.
- [x] T3.4 Verificacao das classes Tailwind do `TIMELINE_EVENTO_META`:
  6 pares de classe (marcador + badge) testados via elemento DOM
  temporario na mesma pagina (CSS ja compilado) - todos resolvem a
  cores distintas via `getComputedStyle` (teal/sky/amber/emerald/
  violet/rose).
- [x] T3.5 Limitacao registrada: nao foi possivel completar o fluxo
  interativo completo (buscar paciente -> clicar -> ver a timeline
  renderizada na tela) porque o clique do Browser tool parou de
  focar QUALQUER elemento da pagina nesta sessao de preview (`click`,
  `double_click`, `form_input` e um `dispatchEvent` manual de `input`
  todos falharam em mover `document.activeElement` para fora de
  `<body>`, mesmo em elementos nao relacionados como o select de
  clinica) - confirmado como limitacao do ambiente/tool nesta sessao,
  nao um bug no codigo (a mesma logica de busca de paciente funcionou
  normalmente nos pacotes anteriores desta sessao, #21 e #38). A
  verificacao end-to-end via `fetch()` direto (T3.3) e a verificacao
  de CSS (T3.4) cobrem, junto com os testes automatizados, a mesma
  superficie que a inspecao visual cobriria.
- [x] T3.6 Revisao adversarial.
- [x] T3.7 `verify.md`.

## 3) Plano de testes

- Backend: `pytest tests/test_atendimento_timeline_limitada.py`
  (4 testes, incluindo o novo de ordem) +
  `pytest tests/ -k "atendimento or timeline"` (suite ampla, 158
  testes, sem regressao).
- Frontend: `tsc`/`build` + verificacao de CSS via DOM temporario +
  verificacao end-to-end via `fetch()` direto ao endpoint real
  (descritas acima).

## 4) Rollback

Reverter o commit deste pacote - mudanca de ordenacao (backend) +
render aditivo (frontend), sem migration, sem mudanca de schema/
contrato de API.
