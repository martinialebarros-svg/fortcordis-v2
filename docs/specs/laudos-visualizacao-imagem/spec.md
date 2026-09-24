# Spec - Visualização de imagem no laudo

## Requisitos funcionais

- RF-001: ao selecionar uma miniatura carregada, exibir a imagem completa em uma sobreposição sem navegar para outra página.
- RF-002: oferecer fechamento por botão e tecla `Esc`.
- RF-003: quando houver mais de uma imagem, permitir navegar para a anterior e a próxima por botões ou teclas direcionais.
- RF-004: disponibilizar a mesma visualização para imagens novas e imagens já persistidas na edição do laudo.
- RF-005: preservar nome, ordem, vínculo, conteúdo e estado de upload da imagem.

## Requisitos não funcionais

- NFR-001 (segurança clínica): a visualização não transforma, recorta nem substitui o arquivo clínico; `object-contain` preserva a imagem integral na tela.
- NFR-002 (privacidade): a visualização usa somente a imagem já carregada no contexto autenticado e não cria nova persistência.
- NFR-003 (acessibilidade): miniaturas e controles devem operar por teclado e o modal deve identificar-se como diálogo.
- NFR-004 (responsividade): a imagem ampliada deve respeitar os limites da janela sem distorção.

## Critérios de aceitação

- CA-001: clicar ou pressionar `Enter`/espaço numa miniatura abre sua visualização ampliada.
- CA-002: o modal informa nome e posição da imagem no conjunto.
- CA-003: `Esc` fecha o modal e restaura a rolagem da página.
- CA-004: setas ou controles anterior/próximo trocam a imagem sem alterar sua ordem no laudo.
