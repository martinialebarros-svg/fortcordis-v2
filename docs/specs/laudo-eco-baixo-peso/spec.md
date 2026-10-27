# Especificação

## Escopo da publicação autorizada — 27/10/2026

Após validar a instalação isolada do laudo em produção, restaurar exclusivamente em stage os 34 caminhos paralelos do snapshot `698dbf40`. Recolocar os blobs explicitamente, manter o código clínico promovido e a ancestralidade de main; não usar essa restauração para levar Gestão ou ajustes de configuração à produção. A preparação pode ficar em rascunho, sem merge antes da validação de produção.

Promover somente referências de baixo peso e conferência canina homologadas em stage `698dbf40` e no laudo sintético #59. Cálculos, condições de idade/técnica e apresentação clínica permanecem iguais ao snapshot testado. Gestão/migração 101 e ajustes de configuração paralelos ficam preservados para restauração exclusiva de stage após a promoção. Não há migração, escrita no catálogo, atualização de frases ou alteração de paciente real nesta entrega.

Na restauracao de stage apos o release de tutores em 2026-10-27, os testes de
comparacao aguardam tambem a primeira linha renderizada antes de inspecionar
os cards: o cabecalho de referencia aparece antes do efeito das comparacoes.
Esse ajuste apenas sincroniza a fixture; nao altera calculos ou apresentacao.

## Causa observada

A seleção escolhia a linha elegível mais próxima e anulava os intervalos estruturais/FEC fora da cobertura das linhas existentes. Assim, um catálogo cuja primeira linha é 3 kg bloqueia também um paciente de 2,5 kg, embora certas publicações contemplem esse peso. Os limites não são universais: TAPSE canino começa em 3 kg; o 2D de Visser começa em 2,6 kg; o domínio reconciliado canino anterior começa em 2,2 kg e o felino tabulado em 1,5 kg.

## Requisitos

- RF-BP-01: para peso positivo finito menor que 3 kg e espécie Canina/Felina reconhecida por normalização exata, preencher somente as seis dimensões M ausentes ou indisponíveis por cobertura: DIVEd, DIVEs, SIVd, SIVs, PLVEd e PLVEs. Preservar qualquer intervalo personalizado realmente elegível. Não extrapolar a linha mais próxima nem inserir/modificar linhas no banco.
- RF-BP-02: o fallback canino utiliza os percentis 2,5/97,5 e expoentes da Tabela 2 de Isayama et al. (2022), em cm convertidos para mm. São limites alométricos aproximados para peso real; não alegar equivalência exata com a Tabela 3 arredondada. O domínio tabulado é 1,5-5 kg; a coorte de 86 cães adultos de pequeno porte, não sedados, tinha peso <5 kg. Não chamar 1,5 kg de mínimo observado da amostra nem adotar a proposta de novo corte terapêutico do artigo.
- RF-BP-03: o fallback felino utiliza os limites individuais da Tabela 3 corrigida de Häggström et al. (2016), nos nós 1,5/2/2,5/3 kg. Nos pesos intermediários, interpolar linearmente os limites e identificar a aproximação do sistema. Não usar IC dos coeficientes da Tabela 2 como PI individual. População: 18.460 gatos adultos de raça pura com ecocardiogramas normais; extremos pouco representados.
- RF-BP-04: abaixo de 1,5 kg, apresentar somente estimativa por extrapolação alométrica, identificada na tela e PDF. Cães mantêm os expoentes da Tabela 2; gatos escalonam os limites de 1,5 kg usando os expoentes centrais da coorte normal. Guardar números apenas em `estimate_min/max`, com limites comparáveis e candidatos nulos. Não atribuir classificação automática nem novo PI95% validado. Arredondamento não implica acurácia clínica de centésimos.
- RF-BP-05: a idade/maturidade acompanha a consulta e a prévia sem campo obrigatório novo. Guarda conservadora de implementação: idade inequivocamente inferior a 12 meses, ou rótulo explícito de juvenil/filhote, bloqueia a referência adulta nova e também seus números de estimativa. Esse limiar é uma proteção do software, não critério de maturidade publicado por Isayama. Idade ausente/ambígua exibe limites adultos apenas como consulta neutra e pede confirmação da aplicabilidade. Adulto conhecido pode receber a comparação numérica calculada dentro do domínio tabulado.
- RF-BP-06: seleção explícita de técnica 2D não recebe os novos limites M; fonte M não preenche espessuras 2D. O carrier de baixo peso não impede Visser 2D já válido a partir de 2,6 kg e com vista/adulto confirmados. Não criar extrapolações de TAPSE, MAPSE, FE, FEC, volumes, Ao/AE, Doppler ou índices diastólicos; seus critérios preexistentes continuam independentes.
- RF-BP-07: preservar valores originais, proveniência de unidade, canônicas limpas, conclusões e presets. Os cálculos de referência ocorrem em cópia de apresentação. Recalcular para o peso/idade/método atual; não reutilizar candidatos antigos após edição, troca de espécie, mudança de técnica ou reimportação. Fonte, DOI, estatística, fórmula/expoente, peso do modelo e contexto da estimativa permanecem auditáveis.
- RF-BP-08: API, fallback da listagem/catálogo vazio, comparação, prévia de laudo salvo e PDF direto recebem o mesmo comportamento. O carrier `id=0` é efêmero. Metadados não se tornam campos editáveis do catálogo. Referências calculadas não são rotuladas como linha cadastrada; estimativas não ganham cor de normalidade. Falta de fonte para outro parâmetro continua explícita.
- RF-BP-09: o PDF referencia Isayama quando utilizado e descreve interpolação/extrapolação/idade conforme o caso, em fonte compacta depois da análise qualitativa. Cornell pode permanecer pertinente ao índice DIVEd normalizado já existente, sem atribuir a ele os novos limites toy. Invalidar somente cache eco (`2026-10-27-eco-low-weight-v28`). Não mudar posição da conclusão ou outras modalidades.
- RF-BP-10: os dois loaders de PDF eco preservam o peso registrado, sem arredondá-lo a uma casa decimal antes de resolver as faixas. O cabeçalho e o resolver recebem o mesmo peso real (por exemplo, 2,25 kg). Restringir o ajuste ao ramo eco; não alterar formatação/cache de outras modalidades.
- RF-BP-11: uma idade reconhecidamente juvenil prevalece sobre a seleção do protocolo/vista 2D rotulado para adultos, mesmo com carrier calculado de baixo peso. Suspender faixa Visser e derivação/exibição do índice normalizado 2D na comparação, editor, prévia e PDF, sem apagar o histórico importado. Idade ausente conserva o contrato anterior de confirmação explícita de cão adulto/vista; carrier ou peso, isoladamente, não confirmam a população. Preservar Cornell M e todas as medidas originais.

## Critérios de aceitação

- CA-BP-01: reproduzir antes da correção a falha de cobertura e ausência de referência sem catálogo; conferir peso real, seis M, preservação do catálogo customizado e imutabilidade.
- CA-BP-02: conferir números publicados por nós/coordenadas independentes e paridade entre Python e TypeScript nos dois lados de 1,5/2,2/2,6/3 kg; peso inválido, espécies não suportadas e aliases exatos.
- CA-BP-03: adulto, juvenil, idade desconhecida, extrapolação, troca de peso/idade/técnica e unidade ambígua não fabricam comparação ou diagnóstico. Cálculo M não altera 2D, Ao/AE, TAPSE ou Doppler.
- CA-BP-04: componentes/hook e prévia mostram fontes e números coerentes; ausência de API/catálogo mantém consulta apropriada sem payload ou campo obrigatório novo.
- CA-BP-05: gerar cinco PDFs sintéticos, extrair valores/notas/bibliografia e revisar visualmente todas as páginas; fonte menor após qualitativa, nenhuma sobreposição ou dado pessoal real.
- CA-BP-06: regressões backend/frontend pertinentes, tipos, lint, build, diff check e SDD aprovados. Entrega local; teste autenticado e publicação em stage exigem pedido posterior.
- CA-BP-07: reproduzir no serviço real a divergência 2,25 -> 2,2 kg entre carga da referência e payload entregue ao renderer; conferir os dois caminhos de emissão eco e a preservação do peso real, com entrada e banco intactos.
- CA-BP-08: reproduzir o P2 da revisão #502 em cão de 7m e 2,6-<3 kg sem catálogo, com ambas as vistas 2D. Testar helpers, editor, comparação, prévia, derivação e PDF, incluindo 2,59/2,6/2,7/2,99/3 kg, adultos, idade desconhecida com/sem protocolo e índice histórico. Juvenil não recebe faixa/índice/bibliografia adulta; adulto mantém os mesmos números anteriores.

## Fontes primárias

- Isayama et al. 2022: https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2022.918457/full
- Häggström et al. 2016, versão corrigida: https://doi.org/10.1111/jvim.14569
- Visser et al. 2019, limites próprios 2D: https://doi.org/10.1111/jvim.15562

Detalhes da conferência primária e limitações: `output/qa/low-weight-reference-20261027/evidence.md` (QA local, não parte do catálogo).
