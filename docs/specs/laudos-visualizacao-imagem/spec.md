# Spec - Visualização de imagem no laudo

## Requisitos funcionais

- RF-001: ao selecionar uma miniatura carregada, exibir a imagem completa em uma sobreposição sem navegar para outra página.
- RF-002: oferecer fechamento por botão e tecla `Esc`.
- RF-003: quando houver mais de uma imagem, permitir navegar para a anterior e a próxima por botões ou teclas direcionais.
- RF-004: disponibilizar a mesma visualização para imagens novas e imagens já persistidas na edição do laudo.
- RF-005: preservar nome, ordem, vínculo, conteúdo e estado de upload da imagem.
- RF-006: permitir zoom entre 100% e 400%, restauração para ajuste à tela e deslocamento da imagem quando ampliada.
- RF-007: permitir reordenar imagens por arrastar e soltar, persistindo a nova ordem tanto na sessão temporária quanto no laudo salvo.
- RF-008: permitir marcar ou desmarcar individualmente a inclusão de cada imagem no PDF sem excluir seu vínculo com o laudo.
- RF-009: imagens existentes e novas devem iniciar incluídas no PDF; a preferência alterada deve sobreviver à associação da imagem temporária ao laudo.
- RF-010: a geração do PDF deve respeitar a ordem e incluir somente imagens marcadas, enquanto a tela de edição continua exibindo todas as imagens ativas.
- RF-011: no primeiro preenchimento do laudo, o upload só pode iniciar depois que a sessão temporária estiver pronta e deve usar essa mesma sessão para upload, reordenação, seleção e associação final.

## Requisitos não funcionais

- NFR-001 (segurança clínica): a visualização não transforma, recorta nem substitui o arquivo clínico; `object-contain` preserva a imagem integral na tela.
- NFR-002 (privacidade): a visualização usa somente a imagem já carregada no contexto autenticado e não cria nova persistência.
- NFR-003 (acessibilidade): miniaturas e controles devem operar por teclado e o modal deve identificar-se como diálogo.
- NFR-004 (responsividade): a imagem ampliada deve respeitar os limites da janela sem distorção.
- NFR-005 (compatibilidade): a migração deve marcar imagens legadas como incluídas no PDF por padrão.
- NFR-005a (portabilidade): a migração deve usar `TRUE` como literal booleano no PostgreSQL e `1` no SQLite.
- NFR-006 (consistência): ordem e seleção de um conjunto devem ser atualizadas atomicamente e restritas ao laudo ou sessão informados.
- NFR-007 (cache): alterar ordem ou inclusão deve produzir uma nova chave de cache do PDF.
- NFR-008 (prudência clínica): excluir do PDF é uma decisão de apresentação; a imagem original permanece vinculada e nenhuma interpretação clínica é gerada.

## Critérios de aceitação

- CA-001: clicar ou pressionar `Enter`/espaço numa miniatura abre sua visualização ampliada.
- CA-002: o modal informa nome e posição da imagem no conjunto.
- CA-003: `Esc` fecha o modal e restaura a rolagem da página.
- CA-004: setas ou controles anterior/próximo trocam a imagem sem alterar sua ordem no laudo.
- CA-005: aumentar o zoom amplia a imagem sem recorte permanente ou transformação do arquivo; “Ajustar à tela” retorna a 100%.
- CA-006: arrastar a segunda imagem para a primeira posição persiste ordens `0` e `1` coerentes.
- CA-007: desmarcar uma imagem mantém o registro ativo e visível na edição, mas a remove da lista de bytes enviada ao renderizador do PDF.
- CA-008: uma imagem legada sem escolha anterior permanece incluída depois da migração.
- CA-009: não é possível atualizar por engano uma imagem pertencente a outro laudo ou a outra sessão temporária.
- CA-010: ao abrir “Novo laudo”, aguardar a sessão e selecionar o primeiro arquivo, o upload envia o `session_id` atual e libera zoom, reordenação e seleção antes de o laudo ser salvo.
