# Spec - atendimento-documentos-template-categorias

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

O `<select>` de escolha de template em `AtendimentoDocumentosSection.tsx`
passa a agrupar suas `<option>` em `<optgroup>` por `tipo`, em vez de uma
lista plana. Nenhuma mudanca de backend. Preview do corpo do template
explicitamente fora de escopo (ver `intent.md`, secao 3).

## 2) Requisitos funcionais (RF)

- RF-001: um novo valor `templatesPorTipo` agrupa `templatesAtivos` por
  `template.tipo` (com fallback `"Outros"` quando vazio), preservando a
  ordem de primeira aparicao dos tipos.
- RF-002: o `<select>` de template renderiza um `<optgroup label={tipo}>`
  por grupo, cada um contendo as `<option>` dos templates daquele tipo
  (mesmo `key`, `value` e texto de antes - `template.id` e `template.nome`).
- RF-003: a opcao inicial `<option value="">Selecionar...</option>`
  permanece fora de qualquer `<optgroup>`, como primeira opcao do select.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem mudanca de valor/selecao): `documentoTemplateSelecionado`
  e o `value` de cada `<option>` continuam sendo o `id` do template
  (como string) - o agrupamento e puramente estrutural/visual.
- NFR-002 (sem nova chamada de rede): `templatesPorTipo` e derivado
  localmente de `documentTemplates` (ja carregado); nenhuma chamada de
  API nova.
- NFR-003 (sem regressao no botao "Criar"): `criarDocumentoClinicoDeTemplate`
  continua funcionando com base em `documentoTemplateSelecionado`,
  inalterado por este pacote.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca. O campo `tipo` ja e retornado por
  `GET /atendimentos/documentos/templates`.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`:
  novo `templatesPorTipo` (RF-001); select de template reestruturado com
  `<optgroup>` (RF-002/RF-003).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca estrutural pura no select;
  nenhum estado, prop ou comportamento de selecao/criacao e alterado.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: com templates de tipos diferentes, o select mostra um
  `<optgroup>` por tipo distinto, cada um com `label` igual ao valor de
  `tipo`.
- CA-002: dois (ou mais) templates com o mesmo `tipo` aparecem dentro do
  mesmo `<optgroup>`, nao em grupos separados.
- CA-003: selecionar uma `<option>` dentro de qualquer grupo atualiza
  `documentoTemplateSelecionado` corretamente com o `id` do template
  (mesmo comportamento de antes).
- CA-004: a ordem dos grupos segue a ordem de primeira aparicao dos tipos
  em `templatesAtivos` (que ja vem ordenada por `ordem` do backend) - sem
  reordenacao alfabetica adicional.
- CA-005: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: template com `tipo` vazio/nulo - cai no grupo `"Outros"` (RF-001),
  em vez de quebrar o agrupamento.
- CB-002: nenhum template ativo (`templatesAtivos` vazio) - `Object.entries({})`
  retorna array vazio, o select mostra so a opcao "Selecionar..." (mesmo
  comportamento de antes, quando a lista de `<option>` era vazia).

## 8) Fora de escopo

- Preview do corpo do template antes de "Criar" (exigiria endpoint novo -
  ver `intent.md`).
- Normalizacao/capitalizacao do valor de `tipo`.
- Mudar o campo "Tipo" do formulario de criacao/edicao de template para
  um select com opcoes fixas.
