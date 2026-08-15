# Spec - atendimento-cobertura-prontuario-real

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Mudanca aditiva de frontend: nova metrica `coberturaMinima` em
`ClinicalQuickSummary`, exibida como painel distinto no editor clinico.

## 2) Requisitos funcionais (RF)

- RF-1: nova interface `ClinicalCoberturaMinima` (`percentual`,
  `completos`, `total`, `pendencias: string[]`) e constante
  `GRUPOS_COBERTURA_MINIMA` com os mesmos 3 grupos (logica OR) de
  `_calcular_pendencias_documentacao` no backend, em
  `frontend/lib/atendimento-clinical-notes.ts`.
- RF-2: `buildClinicalQuickSummary` passa a calcular e retornar
  `coberturaMinima` (via novo helper `buildCoberturaMinima`), alem dos
  campos existentes (`headline`, `highlights`, `pending`,
  `completeness`) - nenhum campo existente e removido ou tem sua logica
  alterada.
- RF-3: `AtendimentoConsultaEditorSection.tsx` substitui o unico card
  "Cobertura do prontuario" por dois cards lado a lado: "Pronto para
  concluir" (`clinicalSummary.coberturaMinima.percentual`, subtitulo
  "minimo exigido para concluir o atendimento") e "Detalhamento"
  (`clinicalSummary.completeness`, mesmo subtitulo de antes, "do editor
  clinico preenchido").
- RF-4: o bloco de "Pendencias"/mensagem de sucesso existente
  (`clinicalSummary.pending`) permanece inalterado neste componente.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (paridade com backend): os 3 grupos e a logica OR devem
  corresponder exatamente a `_calcular_pendencias_documentacao` -
  mesmos campos, mesma relação OR dentro de cada grupo, AND entre
  grupos.
- NFR-B (nao regressao): `AtendimentoClinicalRadarAside.tsx` e o badge
  de navegacao (`page.tsx`) continuam consumindo `completeness`/`pending`
  sem qualquer alteracao de comportamento.
- NFR-C (compatibilidade): nenhuma mudanca de contrato de API/backend;
  `ClinicalQuickSummary` ganha um campo novo (aditivo, nao quebra
  nenhum consumidor existente que ja usa objeto spread/destructuring).

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo. Mudanca 100% frontend.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - campo novo aditivo; nenhum consumidor
  existente lê ou depende da ausência de `coberturaMinima`.
- Rollback: reverter o commit (sem estado persistido).

## 6) Criterios de aceitacao (CA)

- CA-1: atendimento com `queixa_principal` e `exame_fisico` preenchidos,
  `anamnese`/`dados_clinicos`/todos os campos de diagnostico/plano
  vazios -> "Pronto para concluir" = 67% (2 de 3 grupos), "Detalhamento"
  = percentual correspondente a 2/11 campos - os dois numeros devem ser
  visivelmente diferentes.
- CA-2: atendimento com todos os 3 grupos satisfeitos (independente de
  quais campos especificos dentro de cada grupo) -> "Pronto para
  concluir" = 100%, mesmo que "Detalhamento" seja bem menor que 100%.
- CA-3: atendimento sem nenhum campo preenchido -> ambos os percentuais
  em 0%.
- CA-4: badge da aba "Consulta" na navegacao superior continua mostrando
  o mesmo valor de `completeness` de antes (nao muda).
- CA-5: `npx tsc --noEmit` e `npm run build` sem erros novos.
