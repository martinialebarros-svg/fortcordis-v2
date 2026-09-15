# Spec - atendimento-exames-sugestao-foco

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

O dropdown de sugestao de exames em `AtendimentoExamesSection.tsx` passa
a ser exibido ao focar o campo de busca vazio (nao so apos digitar),
mostrando a mesma lista padrao ja computada por `examesCatalogoFiltrados`,
com o rotulo "Sugestoes". Nenhuma mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: um novo estado local `exameBuscaFoco` (boolean, inicial
  `false`) e declarado em `AtendimentoExamesSection.tsx`.
- RF-002: o `<input>` de busca de exame recebe `onFocus={() =>
  setExameBuscaFoco(true)}` e `onBlur={() => setExameBuscaFoco(false)}`.
- RF-003: a condicao de visibilidade do dropdown passa de
  `exameBusca.trim() && examesCatalogoFiltrados.length > 0` para
  `(exameBusca.trim() || exameBuscaFoco) && examesCatalogoFiltrados.length > 0`.
- RF-004: quando `exameBusca` esta vazio (mostrando a lista padrao, nao
  resultado de busca), o dropdown exibe um rotulo "Sugestoes" como
  primeiro elemento, antes da lista de itens.
- RF-005: cada botao de sugestao/resultado recebe
  `onMouseDown={(e) => e.preventDefault()}`, evitando que o clique seja
  perdido por causa do blur do input disparando antes do click do botao.
- RF-006: o `onClick` de cada botao de sugestao/resultado chama
  `setExameBuscaFoco(false)` antes de `adicionarExameDoCatalogo(item)`,
  garantindo que o dropdown feche de forma deterministica apos uma
  selecao, independente de o input permanecer focado ou nao (ver
  `intent.md`, risco 4).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem nova chamada de rede): a lista exibida ao focar e a mesma
  `examesCatalogoFiltrados` ja computada em `page.tsx`, sem nenhuma
  chamada de API adicional.
- NFR-002 (sem regressao na busca ativa): digitar um termo continua
  mostrando os resultados filtrados reais (fuzzy ou substring), sem o
  rotulo "Sugestoes".
- NFR-003 (dropdown nao fica preso aberto): apos clicar fora sem
  selecionar nada, o dropdown fecha (via `onBlur`); apos selecionar um
  item, o dropdown fecha tambem - de forma deterministica, via
  `setExameBuscaFoco(false)` explicito no `onClick` (RF-006), nao por
  dependencia do input perder o foco (que na pratica NAO perde, ja que o
  `onMouseDown preventDefault` do RF-005 mantem o foco durante o clique -
  ver `intent.md`, risco 4, para o bug encontrado e corrigido nessa
  premissa).

## 4) Contratos tecnicos

### API

- Nenhuma mudanca. `GET /exames/catalogo` (consumido indiretamente via
  `catalogoExames` em `page.tsx`) permanece inalterado.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`:
  novo estado `exameBuscaFoco` (RF-001); `onFocus`/`onBlur` no input
  (RF-002); condicao de visibilidade do dropdown atualizada (RF-003);
  rotulo "Sugestoes" condicional (RF-004); `onMouseDown` nos botoes de
  sugestao (RF-005).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca aditiva de UI; a logica de busca,
  filtragem e adicao de exame (`examesCatalogoFiltrados`,
  `adicionarExameDoCatalogo`) permanece inalterada.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: focar o campo de busca de exame vazio exibe um dropdown com ate
  8 sugestoes, rotulado "Sugestoes".
- CA-002: digitar um termo de busca substitui a lista por resultados reais
  de busca, sem o rotulo "Sugestoes".
- CA-003: clicar numa sugestao (com ou sem termo digitado) adiciona o
  exame correspondente a solicitacao e limpa o campo de busca.
- CA-004: clicar fora do campo/dropdown sem selecionar nada fecha o
  dropdown.
- CA-005: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: catalogo de exames vazio (`examesCatalogoFiltrados.length ===
  0`) - dropdown nao renderiza mesmo com foco, mesma logica de antes
  (condicao `.length > 0` preservada).
- CB-002: usuario foca o campo, ve sugestoes, mas clica em outro elemento
  interativo da pagina (nao no dropdown) - dropdown fecha via blur,
  comportamento esperado.

## 8) Fora de escopo

- Ordenacao das sugestoes por frequencia de uso real (exigiria mudanca de
  backend - ver `intent.md`).
- Qualquer mudanca no fluxo de busca de medicamentos da prescricao.
- Mudanca no endpoint ou payload do catalogo de exames.
