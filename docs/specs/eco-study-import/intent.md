# Intent - eco-study-import

## Problema

O preenchimento automatico das medidas do ecocardiograma depende hoje de XML compativel. Muitos equipamentos e fluxos externos entregam somente imagens ou PDF com as medidas impressas na tela, obrigando redigitacao e aumentando risco de erro.

## Objetivo

Adicionar um importador de estudo ecocardiografico que aceite imagem e PDF, extraia medidas exibidas pelo equipamento, normalize os campos para o contrato atual do FortCordis e obrigue revisao antes de aplicar os valores ao laudo.

## Primeira entrega

- Upload de um arquivo por vez: JPG, JPEG, PNG, WEBP, BMP, TIFF ou PDF.
- Processamento assincrono e idempotente por usuario e hash do arquivo.
- OCR de imagens e paginas rasterizadas de PDF.
- Extracao direta da camada textual do PDF quando disponivel.
- Normalizacao das medidas mais frequentes para as chaves atuais do editor.
- Evidencia por pagina/linha, confianca e sinalizacao de conflito.
- Aplicacao somente das sugestoes sem conflito, apos acao explicita do usuario.
- Preservacao integral dos fluxos XML e de cabecalho por imagem existentes.

## Fora do escopo desta entrega

- Diagnostico automatico ou recomendacao terapeutica.
- Medicao anatomica diretamente sobre pixels sem valor impresso pelo aparelho.
- Video, loop, ZIP, DICOM e DICOM SR.
- Ajuste fino para todos os fabricantes sem amostras reais anonimizadas.

## Resultado esperado

Uma base segura para calibrar o importador com estudos reais por aparelho, reduzindo digitacao sem transformar a extracao automatica em fonte clinica definitiva.

As medidas de FE e encurtamento do VE em Modo 2D devem permanecer separadas das
medidas do Modo M no formulario, mas serem comparadas aos mesmos intervalos
clinicos configurados para funcao sistolica.

A razão E/TRIV impressa pelo equipamento deve ser preservada como medida
revisável, sem ser confundida com TRIV. O formulário calcula E/A, E/TRIV e
E/e' diretamente das respectivas medidas de origem quando elas estão
disponíveis.
