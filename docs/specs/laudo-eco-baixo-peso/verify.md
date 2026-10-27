# Verificação local

## Baseline em 27/10/2026

- Backend: seis regressões iniciais, quatro falhas novas e dois controles aprovados antes da implementação. Reprodução da ausência de limites em 2,5 kg abaixo da primeira linha 3 kg, extrapolação ausente, seleção felina e peso editado.
- Frontend: 56 testes iniciais em policy/selectors/prévia/hook, com 13 falhas novas e 43 controles aprovados. Prova `/tmp/echo-low-weight-frontend-baseline-20261027.json`.
- Componente real: ausência de carrier e de linhas sem catálogo reproduzida; controle personalizado válido 2,5 kg aprovado isoladamente. Logs `/tmp/echo-low-weight-ui-{baseline,custom-baseline}.log`.

## Evidências finais locais

| Critério | Resultado | Evidência |
| --- | --- | --- |
| CA-BP-01 | Aprovado localmente | Baselines acima; seleção sem catálogo/cobertura, custom preservado e catálogo/entrada imutáveis nos testes backend/frontend. |
| CA-BP-02 | Aprovado localmente | Fontes primárias reconciliadas; 90 contextos de paridade Python/TypeScript, 4.320 comparações sem divergência. Arredondamento positivo comum half-up a centésimos; regressão explícita 15,125 -> 15,13. |
| CA-BP-03 | Aprovado localmente | Idade adulta/desconhecida/juvenil, 2D, peso inválido/editado, origem de unidade e extrapolação cobertos. Revisão independente: 400 contextos/7.467 verificações e confirmação de que estimativas não entram como referências validadas no contexto IA. |
| CA-BP-04 | Aprovado localmente | 158 testes focados frontend; 10 novos testes do componente real. Prévia real recebe idade e mostra limites/estimativas/retração juvenil sem gravar; o arquivo integrado do visualizador tem 24 testes aprovados. |
| CA-BP-05 | Aprovado localmente | Cinco PDFs sintéticos, seis páginas completas revisadas, incluindo cinco imagens sintéticas na página 2 do controle canino. Valores, notas, fonte menor e bibliografia conferidos, sem sobreposição; juvenis não recebem limites nem estimativas adultas. Prova `output/qa/echo-low-weight-20261027/qa-proof.json`. |
| CA-BP-06 | Aprovado localmente | 122 testes backend e 279 subtestes; 1.702 testes Vitest em 126 arquivos e 23 testes Node. TypeScript, ESLint global, build Next.js, diff check e guardrail SDD aprovados. |
| CA-BP-07 | Aprovado localmente | Baseline do serviço real reproduziu 2,25 -> 2,2 e 2,65 -> 2,6 kg. Regressão final cobre serviço e endpoint público, referência carregada e payload entregue ao renderer, sem escrita DB. Ajuste restrito ao ramo eco dos dois loaders. |

Uma rodada global frontend inicial passou 1.696 casos e falhou no mock legado que exigia somente dois argumentos em `buscarReferencia`; a integração nova encaminha idade opcional. Atualizado esse contrato e acrescentados cinco cenários reais de prévia por idade/espécie/extrapolação. A rodada final passou integralmente. Não houve alteração dos comportamentos clínicos para fazer esse teste passar.

A revisão independente encontrou perda da técnica 2D no envelope de métodos durante reaplicação do resolver. Técnica preservada em `reference_methods`, com regressão de idempotência. A revisão visual também retirou do PDF juvenil a nota de cálculo/fonte adulta inaplicável. Não houve publicação dessas versões intermediárias.

Logs finais: `/tmp/echo-low-weight-{backend-final,full-tests-final,types-final,lint-final,build-final}-20261027.log`. Provas de pesquisa/revisão/paridade e manifesto final em `output/qa/low-weight-reference-20261027/`. O primeiro build encontrou EPERM na escrita de `.next/trace` dentro da worktree; o build autorizado com permissão de escrita local foi concluído, sem alteração de fonte nem acesso à produção.

## Estado de entrega

Implementado e verificado localmente, junto do incremento anterior de coerência. Sem commit, push, deploy, migração, edição do banco de frases/presets, alteração do catálogo ou de pacientes reais. Homologação autenticada/publicação em stage não foi executada neste incremento. Antes de publicar, sincronizar a base com stage e coordenar a fila compartilhada.

## Publicação posterior autorizada — 27/10/2026

Usuário autorizou stage para baixo peso e coerência canina. Preflight remoto: stage `d32f73036544e29a8dd1a74144fb9b486be71dd5`, main `d65b60e2b83276806301bc8ebf37747e43103b85`. Pacote exato de 38 caminhos, 30 hashes de código/testes intactos, nenhuma sobreposição com os 61 caminhos remotos desde a base local. Integrar stage normalmente e preservar Gestão/migração, Agenda, Maps e demais trabalhos. O deploy e a homologação do SHA instalado serão registrados como evidência operacional, sem transportar os dados sintéticos para produção.
