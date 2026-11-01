# Intent — Fluxo de confecção do laudo ecocardiográfico

## Pedido e autorização

Em 01/11/2026, o usuário pediu um plano de implementação e autorizou iniciar as melhorias de fluxo e de apresentação do laudo ecocardiográfico. A primeira entrega foi dividida em duas fatias: fase 1a, neste ciclo, para novos ecocardiogramas com área de trabalho separada; fase 1b, posterior, para edição de laudos existentes. Ambas distinguem salvar o trabalho de emitir o documento. A autorização deste ciclo é para implementação e validação locais; não inclui commit, push ou publicação em stage/produção.

## Problema

O preenchimento reúne importação, medidas, métodos, textos, presets e imagens. Uma interrupção pode exigir reconstruir esse trabalho. No formulário novo auditado, o salvamento comum solicita o estado `Finalizado`; a criação de rascunho existe no caminho de ditado. O usuário precisa poder preservar um exame em elaboração sem emitir o documento nem alterar silenciosamente um laudo já concluído.

## Resultado esperado

Reduzir retrabalho durante a confecção e facilitar ao clínico localizar o resultado relevante no PDF. Reaproveitar importadores, frases, verificações e comparação histórica existentes, acrescentando o mínimo de ações manuais. Preservar a interpretação do veterinário e a identificação do exame.

## Entregas planejadas

1. Rascunho automático, recuperação e ações distintas de salvar/emitir: novos exames na fase 1a; edição de laudos existentes na fase 1b, antes da fase 2.
2. Conferência final com prévia real do PDF antes da emissão.
3. Editor concentrado no exame e identificação completa das páginas.
4. Primeira página orientada à pergunta clínica e comparação longitudinal opcional no PDF.
5. Seleção rápida de imagens principais e apresentação das demais imagens.

Somente a fase 1a está iniciada neste ciclo. Seu rascunho é um workspace privado independente do documento clínico e não usa o salvamento comum de laudos para gravar automaticamente. O ditado iniciado no formulário novo conserva sua criação clínica explícita de um rascunho e a finalização por seu identificador; abrir o editor de um laudo existente continua fora desta fatia. A fase 1b e as fases 2–5 são o roteiro para detalhamento; não são funcionalidades já implementadas ou publicadas.

## Limites clínicos e operacionais

- O rascunho preserva o conteúdo do operador e a proveniência das medidas. Não fabrica valores, métodos, confirmação de ondas, normalidade ou diagnóstico.
- Gravação automática não pode emitir, assinar, liberar no portal, enviar mensagens, gerar cobrança ou modificar cadastro de paciente/tutor. Um documento emitido permanece distinto do trabalho em elaboração.
- No navegador, somente o UUID opaco do workspace fica em `sessionStorage`, separado por usuário e contexto de origem. O snapshot clínico fica no servidor privado. A recuperação do conteúdo encontrado exige ação explícita do operador.
- Nesta primeira fatia, a descoberta do workspace depende do UUID conservado na aba/sessão atual. Não há lista de rascunhos nem garantia de recuperar o trabalho depois de fechar a aba ou mudar de dispositivo.
- O primeiro usuário conhecido permanece vinculado à montagem do formulário. Troca ou perda dessa identidade interrompe o uso da tela e exige reabertura; o snapshot anterior não passa a pertencer ao novo usuário. O servidor confere a identidade autenticada e a precondição explícita de proprietário em cada operação do workspace.
- O workspace permanece recuperável até seu fechamento lógico, sem apagar laudos clínicos. Imagens temporárias continuam sujeitas ao contrato existente de 24 horas; uma imagem ausente exige reenvio e não recebe confirmação falsa de recuperação.
- Identidade e data do exame, espécie, unidades, métodos, textos e referências continuam com seus contratos existentes. Nomes não substituem identificadores.
- O trabalho de revisão do paciente discutido anteriormente está concluído e não integra este incremento. Testes usam somente dados sintéticos isolados.
- Permanecem as decisões de apresentação já aceitas: conclusão no início e referências bibliográficas compactas depois da análise qualitativa.
