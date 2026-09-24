# Plan - Visualização de imagem no laudo

1. Criar um modal reutilizável de visualização com fechamento e navegação.
2. Integrá-lo às miniaturas recém-carregadas e às imagens persistidas na edição.
3. Cobrir o comportamento principal com teste de interface e executar as validações do frontend.
4. Acrescentar zoom e deslocamento à visualização ampliada, sempre preservando a proporção original.
5. Persistir reordenação por arrastar para imagens temporárias e já vinculadas ao laudo.
6. Persistir uma seleção independente de inclusão no PDF, com compatibilidade ligada por padrão para imagens legadas.
7. Filtrar apenas a renderização do PDF e invalidar seu cache quando ordem ou seleção mudarem.
