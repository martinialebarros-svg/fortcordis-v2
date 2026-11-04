# Intent — Fluxo de confecção do laudo ecocardiográfico

## Promoção isolada autorizada —04/11/2026

Pedido humano atual: “Publique em produção a conferência final e a prévia do PDF do laudo.” A entrega inclui a fase1b de rascunho/atualização atômica **como dependência necessária e explícita da prévia na edição**, usada na homologação do caso sintético63. A fase1a já está em produção. O recorte parte de main3f134432 e reaplica os commits funcionais49ca4381/a5ed822a/e541de8c, resolvendo contextos contra o baseline de produção. Nenhuma migração nova:105 já integra main.

Ficam fora do recorte: Gestão/migração101, comparação anterior, classificação/avisos de HP, novas auditorias de referências/aliases e mudanças de WhatsApp/egress/host-routing que só estão em stage. Os cálculos/referências e o renderer oficial v32 de produção são conservados. O helper de avisos usa o normalizador já existente em main; a dependência opcional de HP foi retirada. Viewer/hook/painel e seis respectivos testes permanecem byte idênticos ao corretivo e541de8c homologado.

Stage completo1a5b444a será preservado por ref antes da substituição temporária por um snapshot isolado. A promoção permanece pelo PR protegido direto stage→main, após CI/deploy/homologação do recorte. Depois, restaurar o conteúdo completo de stage com ancestry de main, preservando a salvaguarda operacional e os registros. Não publicar os módulos excluídos nem usar cherry-pick/PR de feature direto em main.

A salvaguarda documentada em deploy-preserve-nginx seleciona ENABLE_NGINX_HTTP2=0 e RELOAD_NGINX_ON_DEPLOY=0 apenas para o SHA cujo commit contém [preserve-nginx]. O merge final em main deverá portar esse marcador. Não altera nginx.conf, TLS/CSP, flags do Atendimento ou os defaults das demais publicações.

O histórico abaixo registra autorizações e validações anteriores; limites antigos de publicação somente local/stage são substituídos apenas pela autorização atual deste recorte. Evidências do recorte e da instalação serão registradas sem converter testes locais ou do stage completo em prova de produção.


## Pedido e autorização

Em 01/11/2026, o usuário pediu um plano de implementação e autorizou iniciar as melhorias de fluxo e de apresentação do laudo ecocardiográfico. A primeira entrega foi dividida em fase 1a, para novos ecocardiogramas com área de trabalho separada, e fase 1b, para edição de laudos existentes. A fase 1a e a correção complementar de seleção de imagens em lote foram posteriormente publicadas em produção pela PR #539; a restauração de stage foi concluída pela PR #540, conforme evidências já verificadas neste chat e registradas em `verify.md`.

As evidências posteriores de publicação e homologação da fase 1b em stage estão em `plan.md` e `verify.md`; a produção dessa fase continua separada. Em 03/11/2026, após a proposta de conferência compacta e prévia real do PDF, o usuário autorizou “pode seguir com o plano”. O ciclo atual implementa e valida localmente a **fase 2**, na branch `codex/echo-pdf-preview-20261103`, baseada em `origin/stage` `45f06feeee3cfe1b695a84facc134fa411f30199`. Não inclui commit, push ou publicação. A recomendação opcional de EGM não foi um pedido explícito de uso e nenhuma skill EGM integra este ciclo.

## Problema

O preenchimento reúne importação, medidas, métodos, textos, presets e imagens. Uma interrupção pode exigir reconstruir esse trabalho. Na etapa inicial, o salvamento comum do formulário novo solicitava `Finalizado`, e a criação de rascunho estava no caminho de ditado; a fase 1a separou a preservação desse trabalho da emissão explícita. Falta estender a proteção à edição de um ecocardiograma existente, sem permitir que autosave, ditado, alteração de imagem ou uma aba antiga substituam silenciosamente o documento clínico.

## Resultado esperado

Reduzir retrabalho durante a confecção e facilitar ao clínico localizar o resultado relevante no PDF. Reaproveitar importadores, frases, verificações e comparação histórica existentes, acrescentando o mínimo de ações manuais. Preservar a interpretação do veterinário e a identificação do exame.

## Entregas planejadas

1. Rascunho automático, recuperação e ações distintas de salvar/emitir: novos exames na fase 1a; edição de laudos existentes na fase 1b, antes da fase 2.
2. Conferência final com prévia real do PDF antes da emissão.
3. Editor concentrado no exame e identificação completa das páginas.
4. Primeira página orientada à pergunta clínica e comparação longitudinal opcional no PDF.
5. Seleção rápida de imagens principais e apresentação das demais imagens.

A fase 1a está entregue em produção; a fase 1b está entregue e homologada tecnicamente em stage conforme as evidências posteriores em `verify.md`. A fase 2 agora autorizada acrescenta conferência compacta e uma prévia gerada a partir do conteúdo atual, sem modificar o laudo oficial. Os documentos de autorização anterior são históricos; o pedido atual limita-se à implementação e validação locais. As fases 3–5 permanecem no roteiro.

## Limites clínicos e operacionais

- O rascunho preserva o conteúdo do operador e a proveniência das medidas. Não fabrica valores, métodos, confirmação de ondas, normalidade ou diagnóstico.
- Gravação automática não pode emitir, assinar, liberar no portal, enviar mensagens, gerar cobrança ou modificar cadastro de paciente/tutor. Um documento emitido permanece distinto do trabalho em elaboração.
- Na edição existente, salvar rascunho não modifica o laudo oficial, seu status, PDF, imagens persistidas ou publicação no portal. A atualização explícita verifica a revisão clínica de origem antes de qualquer efeito; conflito conserva a cópia em elaboração e não é resolvido por mescla automática.
- Atualização confirmada encerra a cópia privada e permite editar novamente a versão oficial atual. Resposta incerta conserva a conferência do resultado; uma cópia com conflito só pode ser descartada por confirmação explícita, sem atualizar o documento oficial e sem apagar uma tentativa clínica pendente.
- Imagens persistidas mantêm seus identificadores e são editadas localmente até a atualização explícita. Novos arquivos continuam temporários, com validade própria; nenhum `File`, binário ou preview é armazenado no snapshot do workspace.
- Sessão e identificadores temporários ficam vinculados à cópia privada. Callbacks de upload, importação e ditado de outra rota, geração, usuário ou sessão são ignorados, para não inserir material de um laudo na edição de outro.
- No navegador, somente o UUID opaco do workspace fica em `sessionStorage`, separado por usuário e contexto de origem. O snapshot clínico fica no servidor privado. A recuperação do conteúdo encontrado exige ação explícita do operador.
- Nas fases 1a/1b deste fluxo, a descoberta do workspace depende do UUID conservado na aba/sessão atual. Não há lista de rascunhos nem garantia de recuperar o trabalho depois de fechar a aba ou mudar de dispositivo.
- O primeiro usuário conhecido permanece vinculado à montagem do formulário. Troca ou perda dessa identidade interrompe o uso da tela e exige reabertura; o snapshot anterior não passa a pertencer ao novo usuário. O servidor confere a identidade autenticada e a precondição explícita de proprietário em cada operação do workspace.
- O workspace permanece recuperável até seu fechamento lógico, sem apagar laudos clínicos. Imagens temporárias continuam sujeitas ao contrato existente de 24 horas; uma imagem ausente exige reenvio e não recebe confirmação falsa de recuperação.
- Identidade e data do exame, espécie, unidades, métodos, textos e referências continuam com seus contratos existentes. Nomes não substituem identificadores.
- O trabalho de revisão do paciente discutido anteriormente está concluído e não integra este incremento. Testes usam somente dados sintéticos isolados.
- Permanecem as decisões de apresentação já aceitas: conclusão no início e referências bibliográficas compactas depois da análise qualitativa.

## Fase 2 — prévia e conferência final

A prévia usa o mesmo gerador, normalização, fontes e políticas do PDF emitido, com identificação de prévia em todas as páginas. A solicitação é explícita, sem custo adicional de geração a cada digitação. A interface reúne pendências existentes e permite chegar ao campo correspondente; ausência de avisos não certifica normalidade ou revisão veterinária. Emitir/atualizar continuam ações próprias com seus controles existentes, sem exigir abrir a prévia a cada exame. Conteúdo alterado invalida uma prévia antiga; nenhum resultado tardio pode ser apresentado para outro exame, usuário ou conjunto de imagens.


## Publicação da fase 2 em stage — autorizada em03/11/2026

Após a implementação/validação local e a liberação da janela do Atendimento, o usuário respondeu “publique” à proposta explícita de publicar em stage e fazer homologação autenticada. Esta autorização substitui a restrição anterior de não commit/push/deploy **somente para stage** e inclui preparação do snapshot, commit/PR/checks/merge/workflow, preservação de runtime e QA sintética. Produção não foi autorizada. Rascunhos privados já existentes e dados clínicos reais são preservados; QA usa um exame novo inteiramente sintético. Não há chamada paga de IA, WhatsApp ou liberação de portal.


### Registro documental de exclusão de HP

O guardrail SDD exige a estrutura de uma feature tocada mesmo quando seu código é temporariamente retirado. O snapshot mantém somente quatro documentos mínimos de eco-probabilidade-hipertensao-pulmonar que registram a exclusão. Não há implementação/avisos/referências/testes de HP na promoção, nem critério clínico declarado aprovado nesses documentos. Os documentos completos, assim como o código, estão no backup1a5b444a e serão restaurados em stage. Guardrail não foi alterado nem recebeu exceção.
