# Spec - atendimento-documento-emitido-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Mudanca aditiva de frontend em 2 arquivos: badge/banner em
`AtendimentoDocumentosSection.tsx`, confirmacao em `page.tsx`
(`baixarPdfDocumentoClinico`).

## 2) Requisitos funcionais (RF)

- RF-1: na lista de documentos, o texto plano `{documento.status ||
  "rascunho"}` e substituido por um badge (`<span>` com `rounded-full`,
  cores distintas): amber (`bg-amber-100 text-amber-800`) com texto
  "Emitido" quando `documento.status === "emitido"`; slate
  (`bg-slate-100 text-slate-600`) com texto "Rascunho" caso contrario.
- RF-2: no painel de edicao, quando `documentoClinicoForm.status ===
  "emitido"`, um banner de aviso (`border-amber-200 bg-amber-50`, icone
  `AlertTriangle`) aparece acima dos campos de titulo/corpo,
  informando que o documento ja foi emitido e que alteracoes so
  refletem no PDF apos gerar um novo.
- RF-3: `baixarPdfDocumentoClinico` (`page.tsx`) passa a exigir
  `window.confirm()` antes de prosseguir quando o documento resolvido
  (`documentoParaPdf`) tem `status === "emitido"` - se o usuario
  cancelar, a funcao retorna sem chamar a API nem fazer o download.
- RF-4: nenhuma mudanca no `titulo`/`corpo` do editor (continuam
  editaveis, sem `readOnly`) e nenhuma mudanca no backend.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (sem falso positivo): documento com `status !== "emitido"`
  (ex.: "rascunho", ou vazio) nunca mostra o banner de aviso nem exige
  confirmacao extra ao gerar PDF pela primeira vez.
- NFR-B (paridade com o dado real): o badge/banner reflete o campo
  `status` que ja vem do backend (via `hydrateDocumentoForm`), sem
  logica nova de deteccao client-side.
- NFR-C (compatibilidade): nenhuma mudanca de contrato de API/backend.

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo. Mudanca 100% frontend.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - so adiciona avisos visuais e uma
  confirmacao extra; nenhum dado ou fluxo existente e bloqueado.
- Rollback: reverter o commit.

## 6) Criterios de aceitacao (CA)

- CA-1: documento com `status="emitido"` -> badge "Emitido" (amber) na
  lista, badge "Rascunho" (slate) para os demais.
- CA-2: ao selecionar um documento emitido para edicao, o banner de
  aviso aparece no editor; ao criar um documento novo ("Novo"), o
  banner nao aparece.
- CA-3: ao clicar "Gerar PDF" (ou "PDF" na lista) de um documento com
  `status="emitido"`, um `window.confirm()` e exibido antes de
  prosseguir; cancelar o dialogo interrompe a acao sem chamar a API.
- CA-4: ao gerar PDF de um documento ainda "rascunho" (primeira
  emissao), nenhum confirm extra e exibido.
- CA-5: `npx tsc --noEmit` e `npm run build` sem erros novos.
