# Spec - atendimento-documentos-busca-filtro

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

`AtendimentoDocumentosSection` ganha um campo de busca por titulo (visivel
so com mais de 4 documentos no atendimento) e passa a agrupar a lista em
"Rascunhos" e "Emitidos", com contagem por grupo. Nenhuma mudanca de
backend, banco ou API.

## 2) Requisitos funcionais (RF)

- RF-001: novo estado local `buscaDocumento` (string, inicial `""`),
  controlando um `<input>` de busca.
- RF-002: o campo de busca so e renderizado quando
  `documentosAtendimento.length > 4`.
- RF-003: a busca filtra por `titulo`, case-insensitive, substring match
  (`titulo.toLowerCase().includes(busca.trim().toLowerCase())`); documentos
  com `titulo` vazio/`null`/`undefined` sao tratados como `""` e nunca dao
  match para um termo nao vazio.
- RF-004: a lista filtrada e dividida em dois grupos, na mesma ordem em que
  chegam de `documentosAtendimento`: "Rascunhos" (`status !== "emitido"`) e
  "Emitidos" (`status === "emitido"`).
- RF-005: cada grupo e renderizado com um cabecalho "Rascunhos (N)"/
  "Emitidos (N)" e so aparece quando `N > 0`.
- RF-006: tres estados de vazio, mutuamente exclusivos:
  - lista original vazia (`documentosAtendimento.length === 0`): mensagem
    "Nenhum documento clinico salvo neste atendimento." (preexistente,
    inalterada);
  - lista original nao vazia mas busca sem match
    (`documentosFiltrados.length === 0`): mensagem
    "Nenhum documento encontrado para \"{busca}\"." (novo);
  - caso contrario: renderiza os grupos (RF-004/RF-005).
- RF-007: cada card de documento mantem exatamente as mesmas acoes e visual
  de antes (Editar, PDF, Remover) - extraido para uma funcao local
  (`renderDocumentoCard`) sem mudanca de comportamento, so de organizacao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem regressao visual com poucos documentos): com 4 documentos ou
  menos, o campo de busca nao aparece; o unico efeito visivel e o
  agrupamento em "Rascunhos"/"Emitidos" (RF-004/RF-005) no lugar da lista
  unica anterior.
- NFR-002 (performance): filtragem e agrupamento são client-side, em memoria,
  sobre um array tipicamente de poucas unidades - sem debounce necessario.
- NFR-003 (sem chamadas de API novas): toda a logica opera sobre
  `documentosAtendimento`, prop ja recebida pelo componente.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca. Contrato de `documentosAtendimento` (formato de cada
  item) permanece o mesmo.

### Banco/migracoes

- Nenhuma.

### Frontend

- Arquivo unico alterado: `frontend/app/atendimento/components/
  AtendimentoDocumentosSection.tsx`.
- Novo import: `useState` (de `react`); `Search` (de `lucide-react`).
- Novo estado: `buscaDocumento` / `setBuscaDocumento`.
- Novas constantes derivadas por render: `buscaDocumentoNormalizada`,
  `documentosFiltrados`, `documentosRascunho`, `documentosEmitidos`.
- Nova funcao local: `renderDocumentoCard(documento)`.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca puramente de apresentacao, sem
  alterar props recebidas nem dados persistidos.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: atendimento com ate 4 documentos nao mostra campo de busca.
- CA-002: atendimento com 5+ documentos mostra o campo de busca.
- CA-003: digitar um termo que casa com o titulo de alguns documentos filtra
  a lista, mantendo o agrupamento Rascunhos/Emitidos e as contagens
  corretas por grupo.
- CA-004: digitar um termo sem nenhum match mostra a mensagem "Nenhum
  documento encontrado para \"...\"", sem renderizar nenhum card.
- CA-005: limpar o campo de busca restaura a lista completa, agrupada,
  identica ao estado antes da busca.
- CA-006: atendimento sem nenhum documento mostra a mensagem original
  "Nenhum documento clinico salvo neste atendimento.", sem campo de busca.
- CA-007: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: documento com `titulo` vazio (`""`) ou ausente nunca da match para
  uma busca nao vazia (RF-003), mas continua aparecendo normalmente quando a
  busca esta vazia.
- CB-002: documento com `status` `null`/`undefined`/qualquer valor diferente
  de `"emitido"` cai no grupo "Rascunhos" (mesma semantica binaria ja usada
  no aviso de documento emitido, pacote #43).
- CB-003: atendimento com documentos so em um dos dois grupos (ex.: so
  rascunhos) mostra apenas o cabecalho daquele grupo, sem cabecalho vazio
  para o outro.

## 8) Fora de escopo

- Filtro por tipo/template estruturado (nao ha campo de tipo no modelo).
- Paginacao da lista de documentos.
- Ordenacao configuravel.
- Persistencia do termo de busca entre navegacoes.
