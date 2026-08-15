# Spec - atendimento-confirm-dialog

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

Novo componente `ConfirmDialog` (`frontend/app/atendimento/components/
ConfirmDialog.tsx`) e uma funcao `confirmarAcao(opcoes): Promise<boolean>`
em `page.tsx`, substituindo as 12 chamadas de `confirm()`/`window.confirm()`
do modulo Atendimento. Nenhuma mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: `confirmarAcao({ titulo, descricao, variante?, confirmLabel?,
  cancelLabel? }): Promise<boolean>` abre o `ConfirmDialog` com as opcoes
  dadas e resolve `true`/`false` conforme a escolha do usuario
  (Confirmar/Cancelar, X, clique no overlay, ou Esc = `false`).
- RF-002: `variante` aceita `"destructive"` ou `"default"` (default:
  `"default"` quando omitida).
- RF-003: as 12 chamadas de `confirm()`/`window.confirm()` em `page.tsx` sao
  substituidas por `await confirmarAcao({...})`, preservando a condicao de
  guard original de cada call site (ex.: `!selecionadoRef.current &&
  hasEncounterContent(atual) && ...`) e a acao executada apos a confirmacao.
- RF-004: as 5 acoes de exclusao citadas no achado (painel, exame, anexo,
  documento, atendimento) usam `variante: "destructive"`.
- RF-005: as demais 7 chamadas (substituicao de rascunho x2, heranca de
  dados, revogacao de portal, conclusao com pendencias, variaveis nao
  reconhecidas no PDF, documento ja emitido) usam `variante: "default"`
  (ou omitem `variante`, que ja default para `"default"`).
- RF-006: `removerExame` (unica chamada sincrona original) e promovida a
  `async`, preservando a ordem de efeitos colaterais existente
  (`clearExamUploadDraft`/`clearExamDropState` antes do guard de
  confirmacao).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (paridade de controle de fluxo): cada `if (!(await
  confirmarAcao({...}))) return;` e uma troca mecanica 1:1 de `if
  (!window.confirm(...)) return;` - mesma posicao no codigo, mesma condicao
  combinada via `&&`, mesmo efeito de early-return.
- NFR-002 (bloqueio de dupla abertura): o overlay do dialogo cobre toda a
  tela (`fixed inset-0`) enquanto aberto, impedindo que uma segunda acao
  dispare um segundo `confirmarAcao` antes do primeiro resolver.
- NFR-003 (foco seguro por padrao): dialogos `destructive` focam
  inicialmente o botao Cancelar; dialogos `default` focam o botao Confirmar
  (paridade com o comportamento do `window.confirm()` nativo, sem risco de
  perda de dados).
- NFR-004 (sem chamada de API nova): toda a logica e client-side; nenhuma
  chamada ao backend foi adicionada ou alterada.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca.

### Banco/migracoes

- Nenhuma.

### Frontend

- Novo arquivo: `frontend/app/atendimento/components/ConfirmDialog.tsx`
  (props via `LooseAtendimentoComponentProps`, mesmo padrao dos componentes
  irmaos `AttachmentPreviewModal`/`PainelExamesModal`).
- `page.tsx`: novo import dinamico `ConfirmDialog` (`ssr: false`); novos
  tipos `ConfirmDialogVariant`, `ConfirmDialogOptions`, `ConfirmDialogState`;
  novo estado `confirmDialogState`; novas funcoes `confirmarAcao` e
  `resolverConfirmDialog`; renderizacao condicional do `ConfirmDialog` ao
  lado dos demais modais condicionais.
- Estrutura visual do `ConfirmDialog`: overlay `bg-slate-950/70`, card
  branco `rounded-[24px]`, icone (Trash2 vermelho para `destructive`,
  AlertTriangle ambar para `default`), titulo, descricao, botao Cancelar
  (neutro) e botao de acao (vermelho para `destructive`, escuro para
  `default`) - visual consistente com o restante do modulo (mesma familia
  de `rounded-*`/paleta do `AttachmentPreviewModal`).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca de apresentacao/mecanismo, mesmas
  condicoes e mesmas acoes pos-confirmacao de antes.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: nenhuma chamada de `confirm()`/`window.confirm()` permanece em
  `frontend/app/atendimento/page.tsx`.
- CA-002: clicar em "Remover"/"Excluir" numa das 5 acoes destrutivas abre
  o dialogo com icone e botao vermelhos, foco inicial no botao Cancelar.
- CA-003: clicar em Cancelar (ou Esc, ou no overlay) num dialogo destrutivo
  fecha o dialogo sem executar a exclusao.
- CA-004: clicar no botao de acao de um dialogo destrutivo executa a
  exclusao (chamada `DELETE`/marcacao `_destroy`) e fecha o dialogo.
- CA-005: um dos avisos informativos (ex.: variavel de template nao
  reconhecida ao gerar PDF) abre o dialogo com icone ambar e botao escuro,
  foco inicial no botao de confirmar.
- CA-006: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: `finalizarAtendimento` reentra em si mesma apos a confirmacao
  (`await finalizarAtendimento(true)`) - o `await confirmarAcao(...)`
  precede essa reentrada exatamente como o `window.confirm()` original.
- CB-002: `removerExame`, ao se tornar `async`, e chamado via `onClick={()
  => removerExame(index)}` em `AtendimentoExamesSection.tsx` - React ignora
  o Promise retornado por um handler de `onClick`, sem necessidade de
  `await` no chamador.

## 8) Fora de escopo

- Acessibilidade dos modais customizados ja existentes (achado #55).
- Mudanca das condicoes de quando cada confirmacao dispara.
- Migracao de `confirm()` fora do modulo Atendimento.
