# Spec - mobile-header-notificacao-overlap

Data: 2026-08-28
Responsavel: Martiniano + Claude
Status: done

## 1) Escopo funcional

Ajustar o stacking context do cabecalho mobile (`.fc-mobile-header`) para que
o dropdown de "Alertas" do `AlertasInternosBell` sempre seja pintado acima do
conteudo das paginas (banners/hero de topo), evitando sobreposicao visual no
celular.

## 2) Requisitos funcionais (RF)

- RF-001: O painel dropdown de alertas internos deve ficar visualmente acima
  de qualquer banner/hero no topo do conteudo das paginas, em telas `< lg`.
- RF-002: Em telas `lg+`, o comportamento existente (sino `fixed`, header
  vira `display: contents`) permanece inalterado.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): nenhuma mudanca de performance esperada (so CSS,
  sem novos elementos ou JS).
- NFR-002 (seguranca/permissoes): nao aplicavel.
- NFR-003 (observabilidade): nao aplicavel.

## 4) Contratos tecnicos

### API

- Nao aplicavel (fix e apenas CSS).

### Banco/migracoes

- Nao aplicavel.

### Frontend

- Telas afetadas: qualquer tela do dashboard no mobile (`< lg`) que tenha
  cabecalho mobile + conteudo com banner/hero no topo (ex.: `/relatorios`).
- Estados de UI: dropdown de alertas aberto (`aberto === true` em
  `AlertasInternosBell`).
- Regras de exibicao/erro: `.fc-mobile-header` passa a ter
  `position: relative` e `z-index: 70` (mesmo valor ja usado pelo wrapper do
  sino, `containerClassName="relative z-[70] ..."` em
  `frontend/app/layout-dashboard.tsx:401`), garantindo que todo o stacking
  context do header (e o dropdown que estoura para fora dele) fique acima de
  conteudo com `z-index: auto` como `.fc-reports-header`.

## 5) Compatibilidade e rollout

- Backward compatibility: total; mudanca aditiva de CSS.
- Feature flag (se houver): nao se aplica.
- Estrategia de rollback: reverter o commit/CSS (`git revert`), restaurando
  `.fc-mobile-header` sem `relative`/`z-[70]`.

## 6) Criterios de aceitacao (CA)

- CA-001: No mobile, abrir o sino de alertas em `/relatorios` (ou qualquer
  pagina com banner no topo) mostra o painel "Alertas" completamente visivel
  e clicavel, sem o banner sobrepondo o conteudo.
- CA-002: Em telas `lg+`, o header mobile continua com `display: contents`
  e o sino continua fixo no canto superior direito, sem regressao visual.

## 7) Casos de borda

- CB-001: Lista de alertas longa o suficiente para exigir scroll interno
  (`max-h-96 overflow-y-auto`) continua funcionando e visivel acima do
  banner.
- CB-002: Paginas sem banner/hero no topo (ex.: telas que comecam direto com
  cards) nao apresentam regressao, pois o ajuste so muda a ordem de pintura,
  nao o layout.

## 8) Fora de escopo

- Criacao de uma escala de z-index global/reutilizavel para o projeto.
- Revisao dos z-index do modal de agendamento (100/80/120).
