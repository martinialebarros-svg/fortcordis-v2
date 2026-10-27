# Verificação local

## Revisão #508 — proveniência da dimensão efetivamente medida

- CA-BP-10: a reprodução inicial canina teve oito falhas: cada uma das seis dimensões M medida isoladamente com faixa customizada recebia Isayama por haver modelos nas outras dimensões não medidas; NaN e unidade ambígua também citavam a fonte. A matriz final ampliou esses controles para cães/gatos e adulto/idade desconhecida, incluindo uma fonte independente de TAPSE no felino para conferir as notas. Com o renderer anterior carregado apenas em memória, três testes parametrizados reproduziram 26 falhas; os 12 controles com uma segunda dimensão realmente atendida pelo modelo passaram. Log `/tmp/echo-pr508-isayama-provenance-baseline.log`.
- O filtro por DOI e intervalo efetivamente exibido foi compartilhado entre os novos modelos canino/felino. As notas de cálculo, interpolação e estimativa também usam somente as dimensões medidas correspondentes; modelos de campos não preenchidos não atribuem fonte à faixa customizada. Cornell, o contrato bibliográfico legado felino, FEC/AE/Ao e outros marcadores permanecem preservados.
- Foco final: 72 testes PDF/resolver aprovados, com as seis dimensões customizadas de ambas as espécies, idade desconhecida, fonte parcialmente utilizada, extrapolação, juvenil, 2D, NaN, unidade ambígua e imutabilidade. PDFs apenas em memória; nenhum artefato PDF persistido ou escrita DB. Log `/tmp/echo-pr508-isayama-provenance-fixed.log`.
- Invalidação específica do cache eco: a revisão de integração reproduziu uma falha e um controle antes da troca para `2026-10-27-eco-bibliography-provenance-v30`; os dois testes passaram depois. Os PDFs v29 já instalados em stage deixam de ser reutilizados; jobs/artefatos anteriores e a chave das demais modalidades permanecem preservados. Logs `/tmp/echo-prod-cache-v30-{baseline,fixed}.log`. Esta evidência é local; os checks da integração e a verificação instalada ainda pertencem à publicação protegida.

## Revisão #508 — bibliografia felina calculada

- CA-BP-09: o renderer anterior citava Häggström para um felino de 7m com seis medidas M e carrier calculado, embora todos os limites adultos estivessem indisponíveis. Cinco testes novos reproduziram 15 falhas: Felina/Cat em 1/2,25/2,99 kg, catálogo ausente ou carrier adulto anterior; número não finito, medidas com unidade ambígua e presença simultânea de outros marcadores. Baseline em `/tmp/echo-pr508-feline-bibliography-baseline.log`.
- O filtro foi restrito à nova origem calculada. Exige medida positiva finita, unidade não ambígua, DOI correto e limites publicados ou estimados realmente exibidos. Adultos, idade desconhecida e extrapolação mantêm a fonte; juvenil sem outra utilização pertinente não a recebe. Catálogo legado, FEC/AE/Ao publicados e estudos de TAPSE/MAPSE, função atrial e fluxos permanecem independentes.
- Após a correção, 69 testes PDF/resolver passaram, incluindo os cinco novos casos parametrizados e os controles M/2D existentes. PDFs foram gerados somente em memória, com verificação de entrada e histórico imutáveis, sem arquivo PDF novo ou escrita em banco. Log `/tmp/echo-pr508-feline-bibliography-fixed.log`.
- A integração invalida somente o cache eco v28 já instalado em stage, usando `2026-10-27-eco-bibliography-age-v29`. A regressão de chave/job reproduziu uma falha no baseline e passou após o ajuste, com o controle de outras modalidades preservado e sem apagar os artefatos antigos. O serviço e seu teste de cache pertencem à integração da revisão; os números/modelos publicados não mudaram.

## Homologação concluída e promoção autorizada — 27/10/2026

- Stage instalado `698dbf409d2fc14203c5e91fedea03ad2c51df47`, workflow `40534203511` concluído com sucesso. Frontend CI, migrações, SDD e gate completo aprovados; 2.374 testes backend no gate (105 pulos opcionais). Os 41 arquivos do pacote clínico foram conferidos com o snapshot instalado.
- Canário instalado aprovado, com catálogo em transação somente leitura e rollback/close: cães/gatos adultos de 2,25 kg, seis dimensões M, sementes sem catálogo, aliases exatos, extrapolação neutra abaixo de 1,5 kg, idade desconhecida/juvenil e proteção 2D em ambas as vistas. PDF sintético gerado, valores/bibliografia revisados visualmente.
- UI autenticada aprovada: limites caninos de 2,25 kg, recálculo ao editar peso para 1 kg, retirada de limites adultos aos 7m e preservação do catálogo felino existente. Um único registro inteiramente sintético #59 foi salvo. PDF baixado pela tela: duas páginas revisadas, seis intervalos corretos para 2,25 kg e fonte Isayama presente; ondas E/A fundidas não mensuráveis. Hash PDF `8f825d1ae69993c5ed9f344f3e6830bdd85394a26f2a5e5d90b0fcb234262539`.
- Smoke: nove rotas em três hosts, três APIs protegidas com 401, 17 hashes JS instalados/servidos iguais e oito marcadores por conjunto de rotas. SHA/manifesto estáveis. Cinco arquivos de frases por ambiente preservados. Provas em `output/qa/stage-echo-release-20261027/final-release-proof.json`, canário instalado, runtime final e renders; HTTP complementar na pasta homônima do clone principal.
- Esta seção atualiza o estado operacional anterior de homologação não executada, preservando o histórico das baselines. O usuário autorizou agora produção destas melhorias. Candidato sobre `main=375611de` com os 41 caminhos clínicos de `stage=698dbf40`, mantendo os 34 caminhos paralelos preservados para restaurar stage após a promoção. A revisão #508 acrescenta as correções documentadas acima, sem alterar os modelos ou números de referência homologados. Exigir checks do candidato, PR protegido stage → main, workflow terminal, preservação de runtime e smoke instalado de produção. A prova de produção será registrada após execução; não usar exceção de gate nem antecipar resultado.

## Restauracao de stage — 2026-10-27

Uma corrida no teste de componente leu os cards apos encontrar apenas o
cabecalho: a referencia e as comparacoes sao renderizadas em efeitos distintos.
O caso falhou na suite completa e passou 10/10 isolado. A fixture agora aguarda
a primeira linha antes das mesmas assercoes. Nao foi alterado codigo clinico.

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

### Revisão da PR #502 — bloqueio etário 2D

- CA-BP-08: reproduzidas seis falhas frontend e 16 subcasos backend antes da correção. O carrier abaixo de 3 kg permitia faixas/índice Visser 2D apesar de idade juvenil conhecida. A idade agora acompanha a derivação, comparação, prévia e PDF; histórico de entrada preservado. Idade desconhecida mantém a confirmação explícita de adulto/vista, sem criar campo obrigatório.
- Sete regressões frontend cobrem ambas as vistas, 2,6/2,7/2,99/3/10 kg, controles adultos, peso/vista inelegíveis e histórico imutável. Backend cobre 30 PDFs em memória (cinco pesos, duas vistas e três contextos etários). Juvenis não recebem faixa, índice nem bibliografia Visser adulta inaplicável.
- Após integrar stage e corrigir a revisão: 1.746 testes Vitest em 130 arquivos, 23 testes Node, 124 testes backend e 339 subtestes aprovados localmente. Logs `/tmp/echo-stage-release-{frontend,node,backend}-final-20261027.log`; o comando inicial acrescentou indevidamente uma opção Vitest ao runner Node, corrigido executando o runner Node separadamente, com 23/23 aprovados.
- O canário instalado ficará em `output/qa/stage-echo-release-20261027/`: exige cwd/SHA stage exatos, transação somente leitura e gera somente PDF sintético temporário. Sua preparação não equivale a execução; deploy e prova instalada ainda serão conferidos após os checks da PR.

Validação final da árvore integrada para esta revisão: 1.899 testes Vitest em 130 arquivos, 23 testes Node e 115 testes backend com 343 subtestes aprovados. TypeScript sem emissão, ESLint global, build Next.js e diff check aprovados. Logs `/tmp/echo-prod-p2-{frontend,backend,types,lint,build}-final-20261027.log`. O primeiro TypeScript esbarrou apenas na escrita do cache incremental fora da sandbox; a mesma verificação sem cache passou. Não houve alteração de fonte para contornar o ambiente.

Validação integrada final dos guards da promoção: 2.203 testes Vitest em 130 arquivos, 23 Node e 118 testes backend com 384 subtestes aprovados. TypeScript, ESLint global, build Next.js, diff check e revisões independentes de fonte/gramática e 48 cenários bibliográficos aprovados. Logs `/tmp/echo-prod-reference-guards-{frontend,backend,types,lint,build}-final-20261027.log`. Canários de stage/produção preparados para cache v30, sete fontes, controles customizados em memória e sem alterar pacientes; execução depende do deploy terminal do SHA corrigido.
