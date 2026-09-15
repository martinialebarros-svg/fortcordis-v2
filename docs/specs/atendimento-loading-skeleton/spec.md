# Spec - atendimento-loading-skeleton

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

O estado `loading=true` de `frontend/app/atendimento/page.tsx` passa a
renderizar um skeleton com `animate-pulse` reaproveitando a estrutura real
do modulo (cabecalho + grid sidebar/workspace), em vez de um texto plano.
A classe CSS `.fc-care-loading`, agora sem uso, e removida. Nenhuma
mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: quando `loading` e `true`, o retorno de `AtendimentoPage` passa a
  ser um bloco `<div className="fc-care-page">` (mesma classe da pagina
  real) contendo um skeleton, em vez de `<div className="fc-care-loading">`
  com texto plano.
- RF-002: o skeleton inclui uma secao `fc-care-header animate-pulse` com
  blocos pulsando representando: icone (circulo), kicker+titulo, descricao,
  e 3 blocos de botao a direita.
- RF-003: abaixo do cabecalho, o skeleton inclui um grid
  `fc-care-layout grid grid-cols-1 gap-6 xl:grid-cols-12` com uma coluna
  lateral (`fc-care-sidebar xl:col-span-3`, 2 blocos pulsando) e uma coluna
  principal (`fc-care-workspace xl:col-span-9`, 2 blocos pulsando maiores).
- RF-004: o container do skeleton tem `role="status"` e `aria-live="polite"`;
  contem um `<span className="sr-only">Carregando modulo de
  atendimento...</span>` reproduzindo o texto original para leitores de
  tela; os blocos visuais (header e grid) tem `aria-hidden="true"`.
- RF-005: a regra CSS `.fc-care-loading` (`globals.css`) e removida;
  suas propriedades compartilhadas com `.fc-care-page` (max-width, margin,
  background, background-size) sao fundidas na definicao unica de
  `.fc-care-page`, sem alterar nenhum valor.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem regressao no layout real): `.fc-care-page` mantem
  exatamente as mesmas propriedades computadas (max-width, background,
  padding, min-height) antes e depois da fusao das regras CSS.
- NFR-002 (responsivo): o skeleton usa as mesmas classes responsivas do
  layout real (`grid-cols-1 xl:grid-cols-12`), herdando o mesmo
  comportamento em telas estreitas sem CSS adicional.
- NFR-003 (acessivel): a experiencia de leitor de tela ao encontrar o
  loading (anuncio do texto "Carregando modulo de atendimento...") e
  preservada, apesar da versao visual ter deixado de ser texto puro.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/page.tsx`: bloco `if (loading) { return (...) }`
  substituido por um skeleton estrutural (ver RF-001 a RF-004).
- `frontend/app/globals.css`: regra `.fc-care-loading` removida; suas
  propriedades compartilhadas fundidas em `.fc-care-page`.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca de apresentacao pura; a condicao
  `if (loading)` e o comportamento apos `loading` virar `false` nao mudam.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: enquanto `loading` e `true`, a tela mostra um cabecalho escuro
  pulsando e um grid com blocos pulsando na lateral e na area principal -
  nao mais um texto estatico isolado.
- CA-002: um leitor de tela anuncia "Carregando modulo de atendimento..."
  ao encontrar o estado de loading (via `role="status"`/`aria-live`/`sr-only`).
- CA-003: apos `loading` virar `false`, a pagina real renderiza
  normalmente, com `.fc-care-page` preservando max-width, background e
  espacamento identicos aos anteriores a fusao de CSS.
- CA-004: nenhuma referencia a `.fc-care-loading` permanece no codigo.
- CA-005: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: em telas estreitas (mobile), o skeleton empilha em 1 coluna
  (`grid-cols-1`), igual ao layout real antes do breakpoint `xl`.
- CB-002: verificacao visual do estado `loading=true` em rede local rapida
  exige forcar a condicao temporariamente (nunca commitado) - documentado
  em `intent.md` e `verify.md`, nao e uma limitacao do codigo entregue.

## 8) Fora de escopo

- Skeleton em outras paginas do sistema.
- Uso de `FortCordisStateShell` (nao se aplica a este loading interno ao
  `DashboardLayout`).
- Fidelidade pixel-perfeita ao layout final.
