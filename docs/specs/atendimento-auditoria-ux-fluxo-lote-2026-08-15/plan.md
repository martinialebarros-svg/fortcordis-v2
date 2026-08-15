# Plan - atendimento-auditoria-ux-fluxo-lote-2026-08-15

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Sequencia de fases

Cada achado foi tratado como uma fase isolada: implementacao, testes
automatizados (type-check/lint/vitest no frontend, pytest no backend),
verificacao manual no navegador (login real, dados semeados via script
quando necessario, limpeza dos dados de teste ao final) e commit
dedicado. `docs.md` desta pasta e escrito depois de todas as fases
concluidas, para satisfazer o guardrail de SDD retroativamente (ver
`verify.md` para detalhes de por que isso ficou pendente).

- Fase 1 (#29): botao "Salvar como frase" inline no `ClinicalFieldCard`.
- Fase 2 (#24): toggle com memoria de aba na pill "Bibliotecas clinicas".
- Fase 3 (#23): remocao do card "Jornada do atendimento".
- Fase 4 (#35): drag-and-drop de exame com card colapsado.
- Fase 5 (#32): selo de visualizacao do exame pela clinica parceira
  (adiada uma vez por conflito de arquivo com sessao paralela do portal
  de clinicas; retomada apos aquele trabalho ser commitado).
- Fase 6 (#49): comparacao de temperatura/FC/FR com a visita anterior.
- Fase 7 (#55): wrapper `Modal` compartilhado + aplicacao nos 2 modais
  sem padrao de acessibilidade.
- Fase 8 (#25, #36, #56): 3 ajustes de baixa prioridade, commitados
  juntos por tocarem regioes distintas dos mesmos arquivos.
- Fase 9 (#45): escopo combinado com o usuario (MVP: barra de
  formatacao + conversao no PDF, sem preview ao vivo), depois
  implementado.
- Fase 10 (este spec): documentacao retroativa SDD do lote inteiro,
  para destravar o guardrail de CI que passou a bloquear o deploy
  (`Deploy to Stage (VPS)`) apos as fases 1-9 serem pushadas sem specs.

## 2) Tarefas por fase

### Fase 1 (#29)

- [x] T1.1 `ClinicalFieldCard.tsx`: botao "Salvar como frase" ao lado
  de "Limpar", com mini-formulario inline (titulo + texto pre-
  preenchido com o valor atual do campo).
- [x] T1.2 `page.tsx`: funcao `salvarFraseRapida` isolada do form da
  aba Bibliotecas, reusando o endpoint `POST /frases-clinicas`
  existente; recarrega `clinicalPhrases` apos salvar.
- [x] T1.3 Testes: 6 casos em `ClinicalFieldCard.test.tsx` (botao
  desabilitado/habilitado, pre-preenchimento, sucesso, erro, sem
  titulo).
- [x] T1.4 Verificacao no navegador: fluxo completo (digitar -> salvar
  -> chip aparece) e erro de titulo duplicado (409 do backend).

### Fase 2 (#24)

- [x] T2.1 `page.tsx`: estado `workspacePainelAnterior` + funcoes
  `abrirBibliotecasClinicas`/`fecharBibliotecasClinicas`.
- [x] T2.2 Pill vira toggle: mostra "Voltar para `<aba>`" quando aberta.
- [x] T2.3 Segundo ponto de entrada (`abrirMedicamentoBuscaRapida`, na
  Prescricao) tambem usa o novo helper.
- [x] T2.4 Verificacao no navegador: Consulta -> Exames -> Bibliotecas
  (botao mostra "Voltar para Exames") -> volta correto; repetido a
  partir da Prescricao via "Ver cadastro".

### Fase 3 (#23)

- [x] T3.1 Remove o card "Jornada do atendimento" de
  `AtendimentoConsultaOverviewSection.tsx` (e o `fluxoClinico` de
  `page.tsx`, so usado ali).
- [x] T3.2 Selo "Triagem concluida" (unico dado que so existia no card
  removido) migra para o card "Consulta" do menu superior.
- [x] T3.3 Verificacao no navegador: secao duplicada sumiu, selo
  aparece/desaparece com o checkbox de Triagem.

### Fase 4 (#35)

- [x] T4.1 `AtendimentoExamesSection.tsx`: card colapsado ganha
  `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop`, reusando
  `examDropActive`/`clearExamDropState`/`uploadArquivosResultadoExame`/
  `setExamUploadDraftFile` ja existentes.
- [x] T4.2 `dragenter` expande o card (`setExamesExpandidos`) e mostra
  destaque visual identico ao dropzone do card expandido.
- [x] T4.3 Verificacao simulando drag via eventos nativos
  (`DataTransfer`) sobre um card colapsado real.

### Fase 5 (#32)

- [x] T5.1 Modelo: campo `visualizado_portal_em` em `Exame`.
- [x] T5.2 Migration `20260815_67_exame_visualizado_portal.py`
  (idempotente, `ALTER TABLE ... ADD COLUMN`).
- [x] T5.3 `liberar_exame_no_portal`/`revogar_liberacao_exame_no_portal`
  zeram o campo na transicao real (nao no retorno idempotente).
- [x] T5.4 `_map_exame` expoe o campo no payload do atendimento.
- [x] T5.5 `baixar_arquivo_anexo_portal` (portal.py) marca o campo no
  primeiro download, gatilhado **so** por `actor_type == "clinica"`
  (endpoint compartilhado com tutor; download do tutor nao pode contar
  como "clinica viu").
- [x] T5.6 `AtendimentoExamesSection.tsx`: selo "Ainda nao visto"
  (ambar) / "Visto em dd/mm hh:mm" (verde) ao lado do botao
  Liberar/Revogar portal.
- [x] T5.7 Testes: reset ao liberar/revogar, migration idempotente,
  clinica-marca vs tutor-nao-marca via `TestClient` HTTP completo.
- [x] T5.8 Verificacao end-to-end real: exame liberado -> autenticacao
  de clinica parceira via `/portal/clinicas/sessao-link` +
  `/portal/auth/verificar-codigo` -> download do anexo -> selo muda
  para "Visto em ..." com timestamp batendo com o banco.

### Fase 6 (#49)

- [x] T6.1 Backend `GET /paciente/{id}/historico`: novos arrays
  `temperaturas`/`frequencias_cardiacas`/`frequencias_respiratorias`
  (mesmo padrao de `pesos`, sem migration - campos ja existiam em
  `AtendimentoClinico`).
- [x] T6.2 `page.tsx`: `ultimoRegistroVital` calcula o registro anterior
  mais recente (excluindo o proprio atendimento em edicao) para cada
  um dos 3 sinais.
- [x] T6.3 `AtendimentoTriagemSection.tsx`: hint "Ultima: X (dd/mm)"
  abaixo de cada campo de Temperatura/FC/FR.
- [x] T6.4 Escopo explicitamente NAO inclui comparacao de resultados de
  exames recorrentes (mencionada na sugestao original, mas fora do
  ajuste de backend descrito no achado).
- [x] T6.5 Testes: novo historico com/sem sinais vitais registrados.
- [x] T6.6 Verificacao no navegador: paciente com visita anterior
  (temp/FC/FR setados) -> novo atendimento do mesmo paciente -> 3
  selos aparecem com os valores e data corretos.

### Fase 7 (#55)

- [x] T7.1 Novo `Modal.tsx`: `role="dialog"` + `aria-modal` +
  `aria-labelledby` + fechar com Escape + clique fora fecha +
  autoFocus no primeiro elemento interativo.
- [x] T7.2 `PainelExamesModal.tsx` (nao tinha nenhum dos recursos acima)
  passa a usar o wrapper.
- [x] T7.3 `AttachmentPreviewModal.tsx` (tinha Escape/clique-fora mas
  sem atributos ARIA) passa a usar o wrapper; listener de Escape
  duplicado removido de `page.tsx`.
- [x] T7.4 Testes: 6 casos para o `Modal` (dialog role, aria, autofocus,
  Escape on/off, clique fora on/off).
- [x] T7.5 Verificacao no navegador nos dois modais.
- [x] T7.6 Achado fora de escopo descoberto durante a verificacao:
  preview de PDF bloqueado por CSP (`frame-src` ausente) - sinalizado
  como tarefa separada (nao fazia parte do #55), corrigido depois via
  PR #59 e verificado manualmente (ver `verify.md`).

### Fase 8 (#25, #36, #56)

- [x] T8.1 (#25) `page.tsx`: divisor sutil + icone `ArrowUpRight` +
  `title` no botao "Laudar", separando-o visualmente das acoes locais.
- [x] T8.2 (#36) `AtendimentoExamesSection.tsx`: 5o tile "No portal" no
  grid de resumo, reusando `resumoExamesFluxo.liberado_portal` ja
  calculado.
- [x] T8.3 (#56) 3 estados vazios filtrados (lista de atendimentos em
  `page.tsx`, exames em `AtendimentoExamesSection.tsx`, documentos em
  `AtendimentoDocumentosSection.tsx`) passam a nomear o filtro ativo e
  oferecer um botao de reset inline.
- [x] T8.4 Verificacao no navegador dos 3 itens (divisor/icone visiveis,
  tile aparece, os 3 resets funcionam).

### Fase 9 (#45)

- [x] T9.1 Escopo combinado com o usuario antes de implementar: MVP
  (barra de formatacao + conversao no PDF, sem preview ao vivo).
- [x] T9.2 `AtendimentoDocumentosSection.tsx`: barra com 3 botoes
  (Negrito/Italico/Lista) sobre o corpo do documento e do corpo do
  template, envolvendo/inserindo a selecao com `**negrito**`,
  `*italico*` ou `- item`.
- [x] T9.3 Backend: nova funcao `_texto_pdf_html_documento`, usada so
  no unico call site que renderiza o corpo do documento em PDF -
  `_texto_pdf_html` generico (~7 outros usos) fica intocada.
- [x] T9.4 Testes: 9 casos no backend (negrito, italico, aninhamento,
  lista multilinha, indentacao, escaping XML, asterisco avulso,
  fallback) + 8 no frontend (insercao com/sem selecao, lista
  multilinha, nao duplicar prefixo).
- [x] T9.5 Verificacao ponta a ponta: barra usada no navegador real,
  documento salvo, PDF gerado via o mesmo codigo do endpoint, texto do
  PDF extraido confirmando ausencia de marcacao literal.

### Fase 10 (este spec)

- [x] T10.1 `intent.md`, `plan.md`, `spec.md`, `verify.md` retroativos
  cobrindo as fases 1-9.
- [ ] T10.2 Push para `origin/stage` e confirmacao de que
  `Deploy to Stage (VPS)` volta a passar.
