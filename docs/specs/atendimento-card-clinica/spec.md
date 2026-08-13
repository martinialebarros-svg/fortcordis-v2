# Spec - atendimento-card-clinica

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

O card de cada atendimento na lista "Atendimentos recentes"
(`frontend/app/atendimento/page.tsx`) passa a exibir um badge com o nome
da clinica (`item.clinica_nome`) quando o filtro de clinica esta em
"Todas as clinicas". Nenhuma mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: no bloco de chips do card (`mt-3 flex flex-wrap gap-2`), um novo
  `<span>` e renderizado como primeiro elemento quando
  `clinicaFiltroAplicado === "" && item.clinica_nome` e verdadeiro,
  exibindo o texto `item.clinica_nome`.
- RF-002: o badge usa o estilo `rounded-full bg-slate-200 px-2.5 py-1
  text-slate-700`, consistente com os demais chips do mesmo container
  (mesma forma, padding e tamanho de fonte herdado do container pai
  `text-[11px] font-medium`), com uma cor de fundo distinta
  (`slate-200`) da do chip de "exame(s)" (`bg-white`).
- RF-003: quando `clinicaFiltroAplicado` e um id especifico (nao ""), o
  badge nao e renderizado, independente do valor de `item.clinica_nome`.
- RF-004: quando `item.clinica_nome` e string vazia (atendimento sem
  clinica associada), o badge nao e renderizado, independente do valor de
  `clinicaFiltroAplicado`.
- RF-005: um novo estado `clinicaFiltroAplicado` (inicial `""`) reflete o
  `clinica_id` efetivamente usado na ultima chamada bem-sucedida a
  `carregarLista` (a mesma variavel `clinicaAtual` ja calculada dentro da
  funcao, respeitando `filtrosOverride?.clinicaId` quando presente) - e
  atualizado no mesmo ponto que `setLista`, `setTotalLista` e
  `setPaginaLista`, nunca a partir do valor ao vivo do `<select>`
  (`clinicaFiltro`) isoladamente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem regressao nos demais chips): a ordem relativa dos chips
  existentes (`exame(s)`, `Receita salva`, `Documentacao incompleta`) e o
  comportamento de quebra de linha (`flex-wrap`) permanecem inalterados.
- NFR-002 (sem mudanca de contrato de API): nenhuma chamada de rede nova
  ou alterada; `clinica_nome` ja e retornado pela API atual.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca. `GET /atendimentos` ja retorna `clinica_nome` (string,
  possivelmente vazia) por item.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/page.tsx`: bloco de chips do card na lista
  "Atendimentos recentes" (dentro do `.map((item) => ...)` de
  `atendimentosVisiveis`) ganha um `<span>` condicional com
  `item.clinica_nome`, gated por `clinicaFiltro === ""`.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca de apresentacao pura, aditiva;
  nenhum estado, prop ou comportamento existente e removido ou alterado.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: com o filtro de clinica em "Todas as clinicas", um atendimento
  com `clinica_nome` preenchido mostra um badge com o nome da clinica no
  card, antes do chip "N exame(s)".
- CA-002: ao selecionar uma clinica especifica no filtro, o badge de
  clinica deixa de aparecer nos cards (mesmo que o atendimento pertenca a
  essa clinica).
- CA-003: um atendimento sem clinica associada (`clinica_nome === ""`) nao
  mostra nenhum badge vazio, com o filtro em "Todas as clinicas" ou nao.
- CA-004: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.
- CA-005: ao trocar o `<select>` de clinica para um id especifico SEM
  clicar em "Aplicar filtros", o badge permanece visivel (a lista exibida
  ainda reflete o filtro anterior); somente apos "Aplicar filtros" (lista
  refeita) o badge correspondente desaparece.

## 7) Casos de borda

- CB-001: atendimento domiciliar (sem `clinica_id`) - `clinica_nome` vem
  como `""` da API; badge nao renderiza (RF-004).
- CB-002: lista com muitos chips simultaneos (clinica + exames + receita +
  documentacao incompleta) - quebra de linha via `flex-wrap`, sem overflow
  horizontal (comportamento ja existente do container).
- CB-003: troca do `<select>` sem aplicar (ver CA-005) - resolvido via
  `clinicaFiltroAplicado` (RF-005), nao via `clinicaFiltro` diretamente.

## 8) Fora de escopo

- Badge de clinica em outras listas/paginas do sistema.
- Icone acompanhando o badge.
- Mudanca no select/filtro de clinica em si.
