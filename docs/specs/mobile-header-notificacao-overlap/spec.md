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
  `position: relative` e `z-index: 20`, garantindo que todo o stacking
  context do header (e o dropdown que estoura para fora dele) fique acima de
  conteudo com `z-index: auto` como `.fc-reports-header`. O valor 20 foi
  escolhido (em vez do `z-[70]` usado inicialmente) para ficar abaixo de
  todo overlay de modal em tela cheia do app (`fixed inset-0`), cujo menor
  valor observado e `z-30` (ex.: `frontend/components/portal/PortalClinicaWorkspace.tsx:1568`),
  evitando que o header/dropdown cubra modais abertos no mobile (financeiro,
  agenda, portal da clinica, etc. usam `z-30/40/50/60`). O wrapper interno do
  sino continua com `relative z-[70]`
  (`frontend/app/layout-dashboard.tsx:401`) — esse valor so importa dentro do
  proprio stacking context do header no mobile (nao escapa para o root) e
  segue necessario em `lg+`, onde o header vira `display: contents` e o sino
  passa a competir diretamente com a sidebar (`z-[60]`) no nivel raiz.

## 5) Compatibilidade e rollout

- Backward compatibility: total; mudanca aditiva de CSS.
- Feature flag (se houver): nao se aplica.
- Estrategia de rollback: reverter o commit/CSS (`git revert`), restaurando
  `.fc-mobile-header` sem `relative`/`z-20`.

## 6) Criterios de aceitacao (CA)

- CA-001: No mobile, abrir o sino de alertas em `/relatorios` (ou qualquer
  pagina com banner no topo) mostra o painel "Alertas" completamente visivel
  e clicavel, sem o banner sobrepondo o conteudo.
- CA-002: Em telas `lg+`, o header mobile continua com `display: contents`
  e o sino continua fixo no canto superior direito, sem regressao visual.
- CA-003: No mobile, ao abrir qualquer modal em tela cheia do app (ex.:
  financeiro `frontend/app/financeiro/page.tsx`, submodais de agendamento
  `frontend/app/agenda/NovoAgendamentoModal.tsx`, portal da clinica
  `frontend/components/portal/PortalClinicaWorkspace.tsx`), o modal continua
  cobrindo o header mobile (e o dropdown de alertas, se estiver aberto), como
  antes desta mudanca.

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
