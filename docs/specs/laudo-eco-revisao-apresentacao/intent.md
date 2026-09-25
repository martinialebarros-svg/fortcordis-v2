# Intent - Revisão da apresentação do laudo ecocardiográfico

## Problema

A prévia do laudo exibe chaves técnicas sem unidades ou faixas, enquanto o PDF exibe linhas vazias e limites fixos que podem não corresponder à espécie, peso ou método. Divergências entre o DIVEd normalizado registrado e o valor recalculado no PDF ficam invisíveis ao revisor. Registros de agenda podem aparecer junto das observações clínicas.

As imagens já têm ordem e campo de descrição no banco, mas a descrição não é editável no fluxo usual nem chega ao PDF, o que dificulta relacionar uma imagem ao achado correspondente.

Textos qualitativos com vários itens por grupo podem ser truncados pela leitura antiga da descrição, fazendo a prévia ou o PDF omitir achados que o profissional já escreveu.

## Objetivo

Facilitar a conferência do laudo já produzido, sem exigir novos campos, cliques ou etapas no preenchimento. Preservar os valores registrados e a decisão clínica do veterinário.

## Limites

- Sem migração, alteração dos bytes das imagens originais, diagnóstico ou etapas obrigatórias de emissão.
- Sem classificação automática de doença ou bloqueio de salvamento.
- Referências vêm do cadastro existente; TAPSE pode usar a faixa auxiliar por peso já empregada pelo sistema. MAPSE sem faixa cadastrada permanece indisponível, pois o antigo fallback confundia intervalo de confiança da média com intervalo de referência individual.
