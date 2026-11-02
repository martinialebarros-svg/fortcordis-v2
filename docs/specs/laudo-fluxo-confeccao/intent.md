# Intent — Fluxo de confecção do laudo ecocardiográfico

## Pedido e autorização

Em 01/11/2026, o usuário pediu um plano de implementação e autorizou iniciar as melhorias de fluxo e de apresentação do laudo ecocardiográfico. A primeira entrega foi dividida em fase 1a, para novos ecocardiogramas com área de trabalho separada, e fase 1b, para edição de laudos existentes. A fase 1a e a correção complementar de seleção de imagens em lote foram posteriormente publicadas em produção pela PR #539; a restauração de stage foi concluída pela PR #540, conforme evidências já verificadas neste chat e registradas em `verify.md`.

Após perguntar pela próxima etapa e responder “prossiga”, o usuário autorizou iniciar a **fase 1b**, antes da fase 2. O ciclo atual é de implementação e validação **locais**, na branch `codex/echo-existing-draft-recovery-20261101`, baseada em stage restaurado `2fef8bb1`. Não inclui commit, push ou publicação em stage/produção. A autorização anterior de publicar a fase 1a não é autorização de publicar a fase 1b.

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

A fase 1a está entregue. A fase 1b está implementada localmente neste ciclo: workspace privado para `/laudos/{id}/editar`, vinculado à identidade e à revisão clínica de origem; recuperação explícita; atualização clínica por ação específica; e controles de conflito, imagens e resposta incerta. Já há verificações automatizadas locais; resultados e lacunas estão em `verify.md`. Ainda não houve homologação visual ou publicação da fase 1b. As fases 2–5 continuam no roteiro; prévia real do PDF e alterações de estrutura do documento não integram este incremento.

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
