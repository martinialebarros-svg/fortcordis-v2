# Spec - atendimento-auditoria-ux-fluxo-lote-2026-08-15

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Escopo funcional

Lote de 11 correcoes de UX/fluxo no modulo de Atendimento Clinico,
originadas da issue de tracking #57. Cada achado e funcionalmente
independente dos demais; agrupados aqui apenas para fins de
documentacao SDD retroativa (ver `intent.md` para o motivo).

## 2) Requisitos funcionais (RF) por achado

### #29 - Biblioteca de frases inline

- RF-29.1: `ClinicalFieldCard` exibe botao "Salvar como frase" ao lado
  de "Limpar", desabilitado quando o campo esta vazio.
- RF-29.2: clicar abre um mini-formulario inline (titulo + texto
  pre-preenchido com o valor atual do campo), sem sair da aba Consulta.
- RF-29.3: salvar chama `POST /atendimentos/frases-clinicas` e
  recarrega o banco de frases; a nova frase aparece imediatamente como
  chip na mesma secao.
- RF-29.4: titulo duplicado na mesma secao retorna 409 do backend
  (comportamento existente, reusado) e mantem o formulario aberto com
  os dados preenchidos para correcao.

### #24 - Memoria de aba em "Bibliotecas clinicas"

- RF-24.1: a pill "Bibliotecas clinicas" memoriza a aba de trabalho
  ativa (Consulta/Exames/Prescricao/Documentos) antes de abrir a
  biblioteca.
- RF-24.2: com a biblioteca aberta, a pill mostra "Voltar para
  `<aba>`" e, ao clicar, restaura exatamente essa aba.
- RF-24.3: o atalho "Ver cadastro" de medicamento (aba Prescricao)
  tambem registra a aba de origem antes de abrir a biblioteca.

### #23 - Remocao da navegacao duplicada

- RF-23.1: o card "Jornada do atendimento" (Triagem/Consulta/Exames/
  Prescricao) e removido da aba Consulta.
- RF-23.2: o sinal de "Triagem concluida" (unico dado exclusivo do card
  removido) passa a aparecer como selo no card "Consulta" do menu
  superior, condicionado a `form.triagem_concluida === 1`.

### #35 - Drag-and-drop com card colapsado

- RF-35.1: um card de exame colapsado aceita `dragenter`/`dragover`/
  `dragleave`/`drop` de arquivo, sem exigir expansao manual previa.
- RF-35.2: `dragenter` expande o card automaticamente e aplica o mesmo
  destaque visual (`border-blue-300 bg-blue-50`) do dropzone do card
  expandido.
- RF-35.3: o `drop` processa o arquivo pelo mesmo caminho do card
  expandido: lote (>1 arquivo) via `uploadArquivosResultadoExame`,
  arquivo unico vira rascunho (`uploadDraft`) para confirmar em
  "Enviar agora".

### #32 - Indicador de visualizacao pelo parceiro

- RF-32.1: `Exame.visualizado_portal_em` (nullable) registra o
  timestamp do primeiro acesso da clinica parceira ao anexo liberado.
- RF-32.2: o campo e gravado **apenas** quando o download do anexo
  (`GET /portal/anexos/{id}/arquivo`) ocorre numa sessao de portal com
  `actor_type == "clinica"` - uma sessao de tutor no mesmo endpoint
  nunca marca o campo.
- RF-32.3: o campo e zerado sempre que o exame e liberado novamente no
  portal (transicao real, nao o retorno idempotente) ou tem a
  liberacao revogada.
- RF-32.4: o card de exame no atendimento mostra "Ainda nao visto"
  (ambar) quando `visualizado_portal_em` e nulo, ou "Visto em dd/mm
  hh:mm" (verde) quando preenchido, ao lado do botao Liberar/Revogar
  portal.

### #49 - Comparacao de sinais vitais entre visitas

- RF-49.1: `GET /paciente/{id}/historico` inclui `temperaturas`,
  `frequencias_cardiacas` e `frequencias_respiratorias` (array de
  `{atendimento_id, data_atendimento, <campo>}`, so com entradas onde o
  valor nao e nulo) - mesmo padrao ja usado por `pesos`.
- RF-49.2: a Triagem mostra, ao lado de cada campo de Temperatura/FC/
  FR, um hint "Ultima: X (dd/mm)" com o valor mais recente de uma
  visita **anterior** (nunca do proprio atendimento em edicao).
- RF-49.3: sem historico anterior para o sinal, nenhum hint e
  exibido.
- RF-49.4 (fora de escopo, explicito): comparacao de resultados de
  exames recorrentes nao esta incluida.

### #55 - Padrao de acessibilidade em modais

- RF-55.1: `Modal` (novo wrapper) aplica `role="dialog"`,
  `aria-modal="true"` e `aria-labelledby` apontando para o titulo do
  conteudo.
- RF-55.2: `Modal` fecha ao pressionar Escape (configuravel via
  `closeOnEscape`) e ao clicar no overlay (configuravel via
  `closeOnOverlayClick`).
- RF-55.3: `Modal` aplica foco automatico ao primeiro elemento
  interativo do conteudo ao montar.
- RF-55.4: `PainelExamesModal` e `AttachmentPreviewModal` usam o
  wrapper; o listener de Escape que antes vivia solto em `page.tsx`
  para o preview de anexo e removido (substituido pelo do `Modal`).

### #25 - Distincao visual do botao "Laudar"

- RF-25.1: um divisor vertical sutil separa "Laudar" dos botoes que
  atuam sobre o atendimento atual ("Novo atendimento", "Salvar
  atendimento").
- RF-25.2: "Laudar" ganha um icone `ArrowUpRight` apos o texto e um
  `title` explicando que abre outra tela.

### #36 - Tile "No portal" no resumo de exames

- RF-36.1: o grid de resumo de exames ganha um 5o tile "No portal",
  exibindo `resumoExamesFluxo.liberado_portal`.

### #56 - Estados vazios com acao de reset

- RF-56.1: lista de atendimentos (Casos recentes) sem resultado mostra
  "Nenhum atendimento encontrado para os filtros atuais." + botao
  "Limpar filtros" (reusa `limparFiltrosLista`).
- RF-56.2: exames filtrados sem resultado nomeiam o filtro ativo
  (`EXAME_FILTRO_OPCOES`) e mostram botao "Ver todos os exames"
  (`setExameFiltroRapido("todos")`); quando o filtro ja e "todos" e a
  lista esta vazia, mostra "Nenhum exame solicitado ainda." sem botao.
- RF-56.3: documentos filtrados sem resultado (busca) mostram botao
  "Limpar busca" (`setBuscaDocumento("")`), alem do texto que ja
  nomeava o termo buscado.
- RF-56.4 (fora de escopo, explicito): o estado vazio de "Anexos e
  Imagens" nao tem filtro/busca associado no codigo atual - nao ha o
  que resetar ali.

### #45 - Formatacao minima em documentos clinicos

- RF-45.1: uma barra com 3 botoes (Negrito/Italico/Lista) aparece
  sobre o textarea de corpo do documento e sobre o textarea de corpo
  do template.
- RF-45.2: cada botao envolve/insere a selecao atual do textarea com
  `**negrito**`, `*italico*` ou prefixo `- ` por linha; sem selecao,
  insere um texto-placeholder.
- RF-45.3: o backend (`_texto_pdf_html_documento`, usado so na geracao
  de PDF do corpo do documento) converte essa marcacao para as tags
  reais do ReportLab: `**x**` -> `<b>x</b>`, `*x*` -> `<i>x</i>`,
  linha iniciada em `- ` -> bullet `•`. O texto e escapado (XML) antes
  da conversao, para que `<`/`&` digitados pelo usuario nunca virem
  markup real.
- RF-45.4: a funcao generica `_texto_pdf_html` (usada em orientacoes de
  prescricao, contexto clinico e outros ~7 pontos) permanece
  inalterada - a formatacao markdown-lite so se aplica ao corpo do
  documento clinico.
- RF-45.5 (fora de escopo, combinado com o usuario): preview ao vivo
  renderizado no editor nao esta incluido.
