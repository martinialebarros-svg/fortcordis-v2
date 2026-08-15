# Intent - atendimento-cobertura-prontuario-real

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #27 ("[UX] 'Cobertura do prontuário' no editor não reflete
o critério real de conclusão do backend"), origem achado #8 da auditoria
UX/fluxo (`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de
tracking #57): `buildClinicalQuickSummary` (`frontend/lib/atendimento-
clinical-notes.ts`) calcula `completeness` como `preenchidos / 11`,
exigindo TODOS os 11 campos clinicos (`CLINICAL_FIELD_ORDER`) para chegar
a 100%. Ja a barreira real de conclusao no backend
(`_calcular_pendencias_documentacao`,
`backend/app/api/v1/endpoints/atendimento.py`) usa logica OR em 3 grupos:

1. `queixa_principal` preenchida;
2. QUALQUER de `anamnese`/`exame_fisico`/`dados_clinicos` preenchido;
3. QUALQUER de `diagnostico_principal`/`diagnostico_secundario`/
   `diagnostico_diferencial`/`plano_terapeutico` preenchido.

Nunca exige retorno recomendado nem prognostico. Um atendimento que ja
satisfaz os 3 grupos (logo, pronto para o backend aceitar a conclusao)
pode aparecer no editor com 18-60% de "Cobertura do prontuario",
levando o vet a preencher campos nao-obrigatorios so para "fechar a
barra" antes de finalizar.

## 2) Objetivo

Mostrar, no painel "Cobertura do prontuario" do editor clinico
(`AtendimentoConsultaEditorSection.tsx`), uma metrica que reflita
EXATAMENTE a mesma logica OR de 3 grupos usada pelo backend para liberar
a primeira conclusao - como uma metrica DISTINTA da existente (nao
substituindo-a), conforme a propria sugestao da auditoria: "separar
visualmente 'campos obrigatórios para concluir' ... de 'campos
complementares recomendados', com duas métricas distintas em vez de uma
única %."

## 3) Nao objetivos

- Nao alterar o badge da aba "Consulta" na navegacao superior
  (`workspaceCards`, `page.tsx`) - continua mostrando `completeness`
  (11 campos) sem alteracao; o issue nomeia especificamente o painel
  "Cobertura do prontuario" dentro do editor, nao o badge compacto da
  navegacao.
- Nao alterar `AtendimentoClinicalRadarAside.tsx` ("Preenchimento" no
  radar do caso) - tambem fora do escopo de arquivos citado pelo issue;
  continua usando `completeness` sem alteracao.
- Nao reescrever a lista de "Pendencias" existente
  (`clinicalSummary.pending`) - mantida exatamente como esta (mesmos 7
  campos verificados individualmente), evitando qualquer efeito colateral
  em `AtendimentoClinicalRadarAside.tsx`, que tambem consome esse mesmo
  campo. A nova metrica de cobertura minima e adicionada ao lado, sem
  remover ou substituir nada existente.
- Nao mudar `_calcular_pendencias_documentacao` nem qualquer
  comportamento do backend - a nova logica no frontend so espelha (le,
  nao decide) o mesmo criterio, mantido em sincronia manual via
  comentario no codigo.
