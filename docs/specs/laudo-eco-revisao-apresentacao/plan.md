# Plan - Revisão da apresentação do laudo ecocardiográfico

1. Organizar a prévia por grupos do PDF e mostrar rótulos, unidades e faixas selecionadas por espécie/peso.
2. Aplicar na prévia a mesma normalização de comprimentos e DIVEd normalizado usada pelo PDF, com aviso quando o valor persistido divergir.
3. Separar linhas de agenda reconhecidas das observações clínicas na prévia.
4. No PDF, apresentar a conclusão já escrita antes das tabelas, omitir parâmetros não registrados e retirar faixas fixas legadas quando não houver faixa na referência selecionada.
5. Validar casos de referência incompleta, ausência de peso, modo M/2D, dados legados em cm, divergência do valor normalizado e PDF renderizado.
6. Oferecer legenda opcional para imagens temporárias e persistidas usando o campo existente, com confirmação da configuração antes do salvamento do laudo.
7. Transportar ordem e legenda da imagem selecionada ao PDF, numerar as imagens, escapar texto de legenda e invalidar o cache quando a descrição muda.
8. Validar persistência restrita à sessão/laudo, compatibilidade de imagens sem legenda e disposição visual com seis imagens.
9. Ler os blocos qualitativos até o próximo campo conhecido ou seção, mantendo todos os itens redigidos; usar a mesma regra na prévia, na edição e nas duas rotas de PDF.
10. Conferir um exemplo sintético com medidas moderadas: evitar assinatura isolada entre narrativa e imagens e manter a última avaliação qualitativa com a assinatura quando não há imagens.
11. Auditar a fonte das faixas auxiliares, retirar o fallback de MAPSE que tratava intervalo de confiança da média como faixa individual e limitar o fallback de TAPSE aos pesos tabulados de 3 a 45 kg.
12. Resolver faixas por política de proveniência versionada, preservar limites brutos e pedir confirmação do método apenas para TAPSE e AE/Ao felino quando registrados.
13. Suspender comparações sem suporte reconciliado de Vmax e dos padrões legados diastólicos; separar o intervalo ponderal de AE/Ao do limiar clínico geral e aplicar limites de cobertura/peso.
14. Validar importação antes da substituição do catálogo, testar persistência/invalidação do método e igualdade entre formulário, prévia, contexto da IA e PDF; publicar o incremento em stage para revisão.
15. No cálculo de AE/Ao, rastrear a origem transitória da razão para limpar resultados derivados quando seus componentes forem removidos, preservando razões importadas independentes; validar novo/editar e repetir o caso sintético em stage.
