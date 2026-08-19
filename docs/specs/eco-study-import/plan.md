# Plan - eco-study-import

1. Criar extrator canonico de medidas para texto, imagem e PDF.
2. Criar modelo, migracao, service de jobs e endpoints autenticados.
3. Criar cliente e componente de revisao no frontend.
4. Integrar em novo e editar laudo sem remover importadores existentes.
5. Cobrir parser, validacoes, conflitos, serializacao e migracao com testes.
6. Validar Python, testes focados, ESLint e TypeScript.
7. Calibrar aliases, regioes e confianca com amostras anonimizadas de aparelhos reais.
8. Provisionar Tesseract em stage e expor seu estado nos checks de runtime.
9. Mapear FE e Delta D/FS do Modo 2D para os mesmos intervalos de referencia
   configurados para o Modo M e cobrir a comparacao com regressao automatizada.
10. Reconhecer E/TRIV como medida própria, exibi-la no formulário e no PDF com
    referência clínica comparativa, e calcular E/A a partir das ondas E e A.
