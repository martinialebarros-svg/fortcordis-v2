# Plan - atendimento-variaveis-template-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (backend): `identificar_variaveis_vazias` + endpoint de
  criacao de documento retorna `variaveis_vazias`.
- Fase 2 (frontend): scan live de placeholders remanescentes, banner,
  toast de criacao com aviso, confirm antes de gerar PDF.
- Fase 3 (verificacao): pytest, `tsc`/`build`, verificacao end-to-end
  via preview local, revisao adversarial, `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `document_context_service.py`: `_VARIAVEL_TEMPLATE_PATTERN`
  (regex compartilhada, extraida do `re.sub` inline anterior);
  `identificar_variaveis_vazias(template_text, contexto)`.
- [x] T1.2 `atendimento.py`, `criar_documento_atendimento`: calcula
  `variaveis_vazias` (titulo+corpo do template) quando `template_id`
  informado; adiciona ao dict de resposta so quando nao vazio.
- [x] T1.3 Novo arquivo de teste `test_atendimento_documento_
  variaveis_vazias.py` (5 casos: valor vazio reportado, valor
  preenchido nao reportado, chave ausente do contexto NAO reportada
  como vazia, chave repetida reportada 1x, template sem chaves).
- Criterio de conclusao: `pytest tests/test_atendimento_documento_
  variaveis_vazias.py` (5/5).
- Risco: baixo - funcao pura nova + 1 campo aditivo na resposta de 1
  endpoint, sem mudanca de schema/persistencia.

### Fase 2

- [x] T2.1 `page.tsx`: `extrairVariaveisNaoResolvidas` (funcao pura de
  modulo); `documentoVariaveisNaoResolvidas` (`useMemo`); tipo
  `DocumentoAtendimento.variaveis_vazias?: string[]`.
- [x] T2.2 `criarDocumentoClinicoDeTemplate`: toast condicional com a
  lista de `variaveis_vazias` da resposta.
- [x] T2.3 `baixarPdfDocumentoClinico`: guard de `window.confirm()`
  baseado em `documentoParaPdf` (nao no estado do editor), antes do
  guard existente de "documento emitido".
- [x] T2.4 `AtendimentoDocumentosSection.tsx`: prop
  `documentoVariaveisNaoResolvidas`; banner amber acima do editor.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, reaproveita padroes visuais (`AlertTriangle`
  + amber) e de interacao (`window.confirm`) ja estabelecidos no
  pacote `atendimento-documento-emitido-aviso`.

### Fase 3

- [x] T3.1 `pytest tests/test_atendimento_documento_variaveis_
  vazias.py` (5/5) e `pytest tests/ -k "atendimento or documento or
  template"` (163/163, sem regressao).
- [x] T3.2 `npx tsc --noEmit` e `npm run build` no worktree - ambos
  limpos.
- [x] T3.3 Verificacao end-to-end via preview local: login via
  `fetch()` autenticado (token Bearer + `localStorage`, mesmo padrao
  usado pelo proprio frontend), paciente real ("celine") com `raca`
  zerada no banco local copiado para o teste, `POST /atendimentos/1/
  documentos {template_id: 1}` (template "Parecer Medico
  Veterinario", que referencia `{{raca}}`, `{{idade}}`,
  `{{tutor_nome}}`) - resposta real confirmou `variaveis_vazias:
  ["idade", "raca", "tutor_nome"]` e o corpo mesclado mostrando a
  lacuna silenciosa exata descrita na auditoria
  (`"...raca , com , de propriedade do(a) tutor(a) ."`).
- [x] T3.4 Limitacao registrada: nesta sessao de preview, nem clique
  (via `computer`, ref ou coordenada) nem digitacao (`computer type`,
  mesmo apos `.focus()` programatico via JS confirmado bem-sucedido)
  registraram como entrada real no DOM (`document.activeElement`
  permaneceu `<body>`, nenhum caractere apareceu no campo) - indicio
  de que o pipeline de input do CDP ficou destravado/desconectado
  nesta sessao especifica do Browser tool, nao um bug de codigo (a
  mesma pagina aceitou `.focus()` programatico sem problema, e os 2
  pacotes anteriores desta mesma sessao, #48 e mais atras #21/#38,
  tiveram cliques reais funcionando normalmente). Sem conseguir
  navegar interativamente ate o editor, a verificacao visual do banner
  e do dialogo de confirmacao nao pode ser capturada nesta sessao;
  mitigado por (a) a verificacao backend end-to-end real (T3.3), que
  cobre a logica de negocio completa, e (b) os dois elementos visuais
  (banner amber com `AlertTriangle`, `window.confirm()` antes de uma
  acao) serem exatamente os mesmos padroes ja implementados E
  verificados visualmente ao vivo no pacote anterior
  `atendimento-documento-emitido-aviso` (achado #43) - nao e um
  mecanismo novo sem precedente de verificacao nesta base de codigo.
- [x] T3.5 Revisao adversarial.
- [x] T3.6 `verify.md`.

## 3) Plano de testes

- Backend: `pytest tests/test_atendimento_documento_variaveis_
  vazias.py` (5 testes novos, funcao pura) + `pytest tests/ -k
  "atendimento or documento or template"` (163 testes, sem
  regressao).
- Frontend: `tsc`/`build` + verificacao end-to-end via `fetch()`
  autenticado contra o endpoint real (descrita acima).

## 4) Rollback

Reverter o commit deste pacote - 1 campo aditivo na resposta de 1
endpoint (backend) + render aditivo e 2 guards de UX (frontend), sem
migration, sem mudanca de schema/persistencia.
