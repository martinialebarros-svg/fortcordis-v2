# Intent - Revisão da apresentação do laudo ecocardiográfico

## Problema

A prévia do laudo exibe chaves técnicas sem unidades ou faixas, enquanto o PDF exibe linhas vazias e limites fixos que podem não corresponder à espécie, peso ou método. Divergências entre o DIVEd normalizado registrado e o valor recalculado no PDF ficam invisíveis ao revisor. Registros de agenda podem aparecer junto das observações clínicas.

As imagens já têm ordem e campo de descrição no banco, mas a descrição não é editável no fluxo usual nem chega ao PDF, o que dificulta relacionar uma imagem ao achado correspondente.

Textos qualitativos com vários itens por grupo podem ser truncados pela leitura antiga da descrição, fazendo a prévia ou o PDF omitir achados que o profissional já escreveu.

## Objetivo

Facilitar a conferência do laudo já produzido, reaproveitando confirmações de aquisição uma vez por exame e sem acrescentar etapas obrigatórias de emissão. Preservar os valores registrados e a decisão clínica do veterinário.

## Limites

- Sem migração, alteração dos bytes das imagens originais, diagnóstico ou etapas obrigatórias de emissão.
- Sem classificação automática de doença ou bloqueio de salvamento.
- Preservar o catálogo numérico existente e vincular consultas publicadas à espécie, aquisição e população. TAPSE mantém a regra auxiliar por peso já adotada; MAPSE sem faixa cadastrada permanece indisponível, pois intervalo de confiança da média não é intervalo individual de referência.


## Incremento autorizado em 25/10/2026 — referências diastólicas por espécie

Após a pesquisa primária de 23/10/2026, o usuário autorizou implementar o próximo passo. A consulta passa a distinguir os intervalos individuais publicados dos dados descritivos, com confirmação de aquisição registrada uma vez por exame e reutilizada na comparação, prévia e PDF. Preservar o preenchimento existente, valores importados, interpretação clínica, ordem da conclusão e bibliografia compacta após a análise qualitativa. Este incremento não autoriza publicação nem alteração de pacientes, banco de frases ou presets em produção.

### Ajuste de coerencia — 26/10/2026

A QA de stage encontrou dicas antigas no editor canino que ainda chamavam E/TRIV<=2,5 e E/e′<=12 de referencia. Retirar essas afirmacoes genericas para manter a mesma disciplina de evidencia da aba Referencias e do PDF, sem acrescentar etapas ao preenchimento nem alterar numeros.


## Incremento autorizado em 26/10/2026 — coerência canina e números citados

O usuário autorizou estender a conferência aos cães, ampliar a comparação entre texto e medidas e executar os testes necessários. Reaproveitar o painel não bloqueante e apresentar somente conflitos objetivos para revisão, sem aumentar etapas de preenchimento, alterar a conclusão, inferir doença por valores isolados ou comparar uma imagem representativa à média do aparelho. Implementação e validação local; publicação não integra este pedido.

## Publicação em stage autorizada em 27/10/2026

Após concluir e testar o incremento, o usuário autorizou publicá-lo em stage junto das referências abaixo de 3 kg. Preservar o stage atual e os trabalhos paralelos, conferir checks/SHA instalado e testar o comportamento no ambiente. Produção não integra essa autorização.
