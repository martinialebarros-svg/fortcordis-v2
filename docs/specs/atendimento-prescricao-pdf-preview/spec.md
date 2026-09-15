# Spec - atendimento-prescricao-pdf-preview

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

O painel "Preview da receita" (`AtendimentoPrescricaoPreview.tsx`) ganha um
botao "Abrir em nova aba" no cabecalho, visivel quando ha um PDF gerado, e
a altura do container do preview passa a ser flexivel
(`min(60vh, 500px)`) em vez de fixa (`500px`). Nenhuma mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: no cabecalho do painel (`<div className="flex items-center
  justify-between ...">`), o lado direito passa a conter, em um container
  `flex items-center gap-3`, o indicador de "Gerando..." existente (quando
  `prescricaoPreviewLoading`) e um novo botao "Abrir em nova aba" (quando
  `prescricaoPreviewPdf` e truthy) - ambos podem aparecer simultaneamente.
- RF-002: o botao "Abrir em nova aba" usa o icone `ExternalLink`
  (lucide-react) e, ao ser clicado, chama
  `window.open(prescricaoPreviewPdf, "_blank", "noopener,noreferrer")`.
- RF-003: o botao nao e renderizado quando `prescricaoPreviewPdf` e
  `null`/vazio.
- RF-004: o container do preview (`<div className="bg-slate-100" ...>`)
  passa a usar `style={{ height: "min(60vh, 500px)" }}` em vez de
  `style={{ height: "500px" }}`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem nova chamada de rede): o botao reutiliza o mesmo valor de
  `prescricaoPreviewPdf` ja em memoria - nenhuma chamada a
  `gerarPreviewPdf` ou a qualquer endpoint e feita ao clicar.
- NFR-002 (altura nunca maior que antes): em qualquer viewport,
  `min(60vh, 500px)` e sempre <= 500px - nenhuma tela passa a ter o
  preview MAIOR do que tinha antes desta mudanca.
- NFR-003 (sem regressao nos demais estados do painel): os estados de
  "sem itens", "carregando", "erro" e "preview nao disponivel" (branches
  existentes do componente) permanecem inalterados.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca. Continua usando `POST /atendimentos/prescricao/preview`
  (inalterado) para gerar o `pdf_base64` original.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/components/AtendimentoPrescricaoPreview.tsx`:
  novo botao condicional no cabecalho (RF-001/RF-002/RF-003); altura do
  container trocada para `min(60vh, 500px)` (RF-004).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca aditiva; nenhum estado, prop ou
  comportamento existente e removido ou alterado.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: com um PDF de preview gerado, o cabecalho do painel mostra um
  botao "Abrir em nova aba" com icone de link externo.
- CA-002: clicar no botao chama `window.open` com o mesmo valor de
  `prescricaoPreviewPdf` usado no `src` do `<iframe>`, com os argumentos
  `"_blank"` e `"noopener,noreferrer"`.
- CA-003: sem PDF gerado (formulario vazio, erro, ou carregando pela
  primeira vez), o botao nao aparece no DOM.
- CA-004: em viewport de altura reduzida (ex.: 720px), a altura computada
  do container de preview e menor que 500px (`min(60vh, 500px)` = 432px);
  em viewport de altura grande (ex.: 1200px), a altura permanece capada em
  500px, identica ao comportamento anterior.
- CA-005: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: preview sendo regenerado (`prescricaoPreviewLoading === true`)
  enquanto um PDF anterior ainda esta em `prescricaoPreviewPdf` - o botao
  continua visivel (abre o PDF anterior, ainda valido), junto com o
  indicador "Gerando...".
- CB-002: erro de geracao (`prescricaoPreviewErro` truthy,
  `prescricaoPreviewPdf` null, pois e limpo no catch) - botao
  corretamente ausente; permanece so o "Tentar novamente" existente.

## 8) Fora de escopo

- Qualquer mudanca no fluxo de "Baixar PDF" da aside.
- Controles de visualizacao dentro do iframe (zoom, paginacao).
- Mudanca no endpoint ou payload de geracao do PDF.
