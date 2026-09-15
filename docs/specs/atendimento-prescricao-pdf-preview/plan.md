# Plan - atendimento-prescricao-pdf-preview

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): botao "Abrir em nova aba" condicional no cabecalho;
  altura flexivel do container do preview.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (geracao
  de PDF real, verificacao do botao e da altura em multiplos viewports),
  revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Importar `ExternalLink` de `lucide-react`.
- [x] T3.2 Envolver o indicador "Gerando..." existente e o novo botao em
  um `<div className="flex items-center gap-3">` no lado direito do
  cabecalho.
- [x] T3.3 Adicionar botao condicional (`prescricaoPreviewPdf ? (...) :
  null`) chamando `window.open(prescricaoPreviewPdf, "_blank",
  "noopener,noreferrer")`.
- [x] T3.4 Trocar `style={{ height: "500px" }}` por
  `style={{ height: "min(60vh, 500px)" }}` no container do preview.
- Criterio de conclusao: `tsc --noEmit` aprovado, JSX valido.
- Risco: botao aparecer sem PDF valido - mitigado por reusar a mesma
  condicao truthy ja usada pelo `<iframe>` na linha seguinte.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas `8131`/`3111`), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Confirmado via JS que, sem itens de prescricao, o botao nao
  aparece (`rightDivHTML` vazio) e a altura e `min(60vh, 500px)`
  computando 432px em viewport de 720px de altura.
- [x] T4.4 Redimensionado o viewport para 1200px de altura: confirmado
  que a altura computada permanece capada em 500px.
- [x] T4.5 Adicionado um item de prescricao real (Pimobendan, dose,
  frequencia, via preenchidos) e reaberto o painel de preview (necessario
  porque a geracao so e disparada ao abrir o painel, nao em cada mudanca
  de campo) - confirmado via rede que `POST
  /atendimentos/prescricao/preview` retornou 200 OK com um PDF real
  (`data:application/pdf;base64,JVBERi0xLjQK...`), e que o botao "Abrir em
  nova aba" passou a aparecer no cabecalho.
- [x] T4.6 Interceptado `window.open` via monkey-patch temporario (so em
  memoria, revertido logo em seguida) e clicado o botao: confirmado que
  foi chamado exatamente uma vez, com o mesmo data URL do `<iframe>`,
  `"_blank"` e `"noopener,noreferrer"`.
- [x] T4.7 Checado console/rede: os 500 encontrados sao todos do
  pre-existente `/api/v1/alertas-internos` (mesma causa documentada nos
  pacotes anteriores #50/#30); um erro de CSP de framing do proprio
  iframe apareceu apenas dentro do sandbox do navegador de preview
  (nao presente no `<iframe>` em si, que nao foi alterado por este
  pacote) - nao relacionado a este diff.
- [x] T4.8 Revisao adversarial via agente, focada em: condicao do botao;
  reaproveitamento correto do mesmo base64; corretude do `min()`;
  ausencia de regressao nos demais estados do painel.
- Criterio de conclusao: tsc/build limpos, botao e altura confirmados
  estruturalmente e via JS, sem achados nao tratados na revisao
  adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local; gerado um PDF real via a API de
  preview, botao testado via monkey-patch de `window.open`, altura
  testada em 2 viewports distintos (720px e 1200px de altura).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: `gerarPreviewPdf`/`prescricaoPreviewPdf` (estado
  pre-existente em `page.tsx`) - **atendida**, inalterada por este
  pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca
  de API).
- Nota (nao-bloqueante): o preview local acusou 500 em
  `/api/v1/alertas-internos` (drift de schema pre-existente no snapshot
  do banco copiado), sem relacao com este pacote.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com
  banco copiado (gitignored, removido ao final).
