# Spec - Revisão da apresentação do laudo ecocardiográfico

## Requisitos

- RF-001: a prévia agrupa apenas medidas ecocardiográficas registradas por VE, átrio/aorta, artéria pulmonar, Doppler e regurgitações, com rótulos clínicos, valores e unidades alinhados ao PDF.
- RF-002: a prévia busca a referência existente de forma assíncrona por espécie e peso, mostra a linha de peso selecionada e só exibe faixa completa quando disponível. Falha da busca não bloqueia a prévia.
- RF-003: a prévia usa a mesma regra do PDF para reconhecer dimensões legadas com unidade ambígua e calcular `DIVEd [cm] / peso^0,294` somente quando a unidade é conhecida. Se o valor persistido da técnica selecionada diferir em mais de 0,05, sinaliza ambos os valores e o peso usado, sem gravar ou alterar o laudo; medidas da técnica não selecionada não geram alerta visível.
- RF-004: linhas iniciadas por `[Assistente agenda]` ou `[Reserva manual]` aparecem em registro operacional; as demais permanecem em observações clínicas.
- RF-005: o PDF exibe apenas grupos e parâmetros com medida numérica não zero registrada; quando não há medidas, informa sua ausência.
- RF-006: o PDF só exibe faixas completas obtidas da referência selecionada por espécie e peso. TAPSE pode usar a faixa auxiliar por peso já aplicada pelo serviço; MAPSE sem faixa cadastrada permanece indisponível, assim como qualquer parâmetro sem referência.
- RF-007: o PDF informa o cadastro selecionado sem a nota explicativa sobre faixa auxiliar de TAPSE ou traço; as faixas e a ausência delas continuam representadas nas tabelas, sem atribuir bibliografia ausente dos dados nem criar interpretação diagnóstica.
- RF-008: a conclusão redigida pelo veterinário aparece uma única vez, antes das tabelas quantitativas, para leitura na primeira página.
- RF-009: cada imagem aceita uma legenda opcional no fluxo de novo laudo e de edição; o editor limita novas entradas a 160 caracteres e preserva descrições legadas maiores, sem bloquear upload ou salvamento quando vazia.
- RF-010: ordem, inclusão e legenda são persistidas na sessão ou laudo correspondente; o salvamento confirma a configuração antes de associar a imagem ao laudo.
- RF-011: o PDF numera as imagens na ordem selecionada, repete identificação do paciente/data do exame em toda página que contenha imagens, inclusive se uma grade continuar na página seguinte, e exibe somente a legenda explicitamente registrada; imagens sem legenda recebem apenas o número.
- RF-012: alterar a legenda muda a chave de cache do PDF. Chamadas antigas de configuração sem `descricao` preservam a descrição existente.
- RF-013: blocos qualitativos curtos permanecem com a análise quantitativa na página inicial quando há espaço, sem quebra causada por agrupamento aninhado.
- RF-014: prévia, edição e renderização do PDF preservam todos os itens de cada campo qualitativo até o próximo campo conhecido ou seção, inclusive quando um campo contém múltiplos bullets.
- RF-015: o download direto e o serviço de PDF em segundo plano usam a mesma legenda de imagem e a mesma seleção de referência por espécie e peso.
- RF-016: em relatórios que quebram após a análise qualitativa, a assinatura não ocupa sozinha uma página; com imagens, a grade pode aproveitar a página da assinatura, e sem imagens a última descrição qualitativa permanece com ela.
- RF-017: o serviço não gera faixa auxiliar de MAPSE a partir de intervalos de confiança da média; valores explicitamente cadastrados continuam legíveis. TAPSE não aplica a tabela auxiliar fora dos pesos de 3 a 45 kg.
- RF-018: respostas de uploads sucessivos atualizam somente o status da imagem correspondente e preservam legendas digitadas enquanto as demais imagens ainda são enviadas.
- RF-019: dimensões legadas sem metadado de unidade, entre 0,3 e 3,5 em conjunto antes elegível à conversão, permanecem com o valor registrado e são sinalizadas como unidade a confirmar na prévia e no PDF. Essas medidas não recebem faixa de referência nem interpretação automática; DIVEd ambíguo não gera DIVEd normalizado. TAPSE, MAPSE e valores fora desse conjunto permanecem intactos.
- RF-020: TAPSE e MAPSE registrados aparecem em grupo próprio na prévia e no PDF, independentemente da técnica escolhida para as medidas do ventrículo esquerdo.
- RF-021: alterações no texto do PDF ecocardiográfico incrementam sua versão do renderizador na chave de cache, para que laudos já emitidos sejam gerados novamente sem modificar os dados clínicos armazenados ou invalidar o cache das outras modalidades.
- RF-022: a prévia identifica o cadastro de referência selecionado sem exibir a nota auxiliar sobre TAPSE, mantendo as faixas medidas nas tabelas.
- RF-023: quando o laudo ecocardiográfico tem imagens e não tem anexo de pressão arterial, a assinatura acompanha o último grupo qualitativo na mesma página; a grade de imagens pode começar após esse conjunto e continua identificada em cada página.
- RF-024: a análise qualitativa usa espaçamento compacto e legível para evitar uma página quase vazia contendo apenas o último grupo e a assinatura; se a narrativa ocupar outra página, a grade aproveita o espaço disponível após a assinatura sem quebrar compulsoriamente após cada conjunto de seis imagens.

## Requisitos não funcionais

- NFR-001: nenhuma etapa ou campo obrigatório novo; laudos sem imagem não fazem requisição de configuração, e laudos com imagem confirmam ordem/legenda antes de salvar para evitar perda na associação.
- NFR-002: falhas de referência, peso ausente ou dados conflitantes não produzem faixa suposta nem reescrevem medidas armazenadas.
- NFR-003: outras modalidades de laudo e os bytes das imagens não são alterados.
- NFR-004: o texto da legenda é escapado no PDF e não serve para inferir diagnóstico ou modalidade.

## Aceitação

- CA-001: com DIVEd 47,19 mm, peso 13,9 kg e valor registrado 1,964, a prévia mostra 2,18 e avisa a divergência; o dado persistido continua 1,964.
- CA-002: com modo 2D selecionado, a prévia e PDF exibem somente o grupo VE 2D, preservando os demais grupos medidos.
- CA-003: referência ausente ou incompleta não gera limite fixo substituto na prévia ou PDF.
- CA-004: PDF com somente DIVEd não contém linhas vazias de Doppler ou regurgitações.
- CA-005: texto administrativo reconhecido aparece separado, enquanto achados clínicos permanecem nas observações.
- CA-006: a conclusão aparece uma única vez antes da análise quantitativa no PDF.
- CA-007: uma legenda opcional informada antes de salvar aparece sob a imagem correta no PDF, mesmo quando o laudo é salvo imediatamente após a edição.
- CA-008: imagem sem legenda aparece numerada e sem texto clínico inferido; seis imagens com legendas usuais cabem na grade de uma página. Quando legendas extensas fazem a grade continuar, cada página recebe título, paciente e data do exame.
- CA-009: editar a legenda de uma imagem não altera a de outra; configurações sem campo de legenda não apagam descrições legadas.
- CA-010: um laudo curto com uma medida, uma linha qualitativa e assinatura cabe em uma página; com seis imagens adicionadas, a grade numerada cabe na página seguinte.
- CA-011: duas descrições de valvas no mesmo campo aparecem integralmente na prévia e no PDF; texto de uma seção seguinte não entra na avaliação qualitativa.
- CA-012: um exemplo sintético de tamanho moderado ocupa duas páginas, com assinatura e seis imagens juntas na segunda; sem imagens, a última descrição qualitativa acompanha a assinatura.
- CA-013: MAPSE sem faixa cadastrada mostra faixa indisponível e TAPSE fora dos pesos tabulados também; valores cadastrados permanecem intactos.
- CA-014: ao digitar a legenda da primeira imagem enquanto a segunda ainda está sendo enviada, a conclusão do segundo upload mantém a legenda visível e a configuração salva contém os dois identificadores com a descrição correta.
- CA-015: quando modo M e 2D têm DIVEd normalizado divergente, somente a técnica selecionada gera alerta na prévia, embora os dois cálculos permaneçam disponíveis para a apresentação adequada.
- CA-016: em um conjunto legado misto sem unidade de origem, dimensões ambíguas conservam o número registrado e mostram unidade a confirmar; TAPSE, MAPSE e aorta já em mm mantêm seus valores na prévia e no PDF.
- CA-025: em um conjunto legado com DIVEd 2,5, DIVES 1,5, átrio esquerdo 2,0 e SIVd já em mm 3,0, prévia e PDF não apresentam SIVd como 30 mm, nem calculam DIVEd normalizado com unidade incerta.
- CA-017: ao selecionar modo 2D para o ventrículo esquerdo, TAPSE e MAPSE preenchidos continuam visíveis na prévia e no PDF, com valores e unidades preservados.
- CA-018: a seleção de faixas ecocardiográficas usa apenas aliases explícitos de espécie. Espécies não reconhecidas, como `Cattle`, não recebem faixas felinas ou caninas na prévia, na consulta de referências ou no PDF; uma espécie sem cadastro mostra referência indisponível.
- CA-019: após retirar a nota sobre TAPSE e traço, um PDF anteriormente guardado em cache não é reutilizado; a nova renderização conserva as medidas e as faixas de referência.
- CA-020: a prévia do laudo mostra a espécie e o peso do cadastro selecionado sem a frase auxiliar sobre TAPSE; os valores e as faixas de referência não são alterados.
- CA-021: um laudo sintético longo com assinatura e 12 imagens mantém a assinatura na mesma página do último grupo qualitativo, sem perder a última imagem ou a identificação do paciente nas páginas de imagens; casos curtos e moderados mantêm a paginação esperada.
- CA-022: a versão do renderizador de ecocardiogramas avança após a mudança de paginação para regenerar PDFs em cache sem invalidar as demais modalidades.
- CA-023: um laudo sintético extenso com três descrições no último grupo, assinatura e 12 imagens ocupa cinco páginas: o último grupo e a assinatura ficam juntos, e as imagens 1–6 e 7–12 ocupam as duas páginas seguintes, respectivamente.
- CA-024: a nova paginação incrementa apenas a versão de cache do PDF ecocardiográfico, preservando as chaves de cache das outras modalidades.
