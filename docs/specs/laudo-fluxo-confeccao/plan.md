# Plan — Fluxo de confecção do laudo ecocardiográfico

## Estratégia de entrega

Entregar incrementos pequenos e verificáveis. Cada fase deve preservar o preenchimento clínico existente e ter critérios próprios de aceitação. Preparar e validar localmente; publicação em stage e promoção a produção exigem o pedido correspondente e a verificação da versão efetivamente instalada.

## Fase 1a — Novos ecocardiogramas: rascunho e recuperação (iniciada)

1. Conferir criação de laudo, importação, autenticação e sessão de imagens; restringir o delta ao formulário de novos ecocardiogramas. Usar a worktree isolada `codex/echo-draft-recovery-20261101`, baseada em `origin/stage`, preservando alterações alheias e o editor de laudos existentes.
2. Implementar workspace privado no servidor, independente de `Laudo` e de cadastros. Expor leitura por GET, gravação por PUT com revisão esperada (CAS) e identificador de operação para repetição, e fechamento lógico por POST também condicionado à revisão. Exigir `X-Editor-Owner-Id` e conferir sua correspondência com a identidade autenticada nas três operações, sem tratá-lo como credencial. Preservar o workspace até fechamento lógico; não apagar registros clínicos.
3. Definir um snapshot bruto recuperável com medidas, proveniência, métodos/ondas, qualitativa, conclusão, observações, dados de contexto e descritores das imagens já recebidas. Excluir `File`, binários, previews/data URLs e credenciais. Manter somente UUID opaco em `sessionStorage`, isolado por usuário e contexto de origem da URL, não pelos campos vazios iniciais. A primeira fatia descobre o workspace somente enquanto a referência existir na aba/sessão; não implementar lista de rascunhos nem prometer recuperação após fechar a aba ou trocar de dispositivo.
4. Após concluir a inicialização do contexto de origem, consultar o workspace e oferecer recuperação explícita. Enquanto a decisão de recuperar estiver pendente, não salvar o formulário vazio sobre o conteúdo existente. Vincular a montagem ao primeiro usuário conhecido e bloquear sua continuidade se a identidade mudar ou desaparecer; sem usuário identificável, bloquear ditado e emissão de novo eco. Usar debounce inicial de 1.500 ms, fila de gravações e proteção de respostas antigas; não reaplicar padrões sobre confirmações recuperadas. Voltar e cliques comuns em links internos da mesma aba devem concluir a fila antes da navegação; em falha, conservar a tela. A proteção `beforeunload` cobre saída nativa; botão Voltar do navegador e navegação programática externa não estão interceptados nesta fatia.
5. Recuperar imagens temporárias consultando os identificadores da sessão já recebidos pelo sistema. Respeitar a validade existente de 24 horas, conferir disponibilidade e pedir reenvio das ausentes. Revalidar as imagens temporárias antes da emissão e conferir o conjunto esperado por quantidade e metadados no laudo depois da associação. Resposta HTTP bem-sucedida, isoladamente, não comprova associação de todas as imagens esperadas. Recuperação do workspace não estende nem comprova a existência das imagens.
6. Separar as ações de salvar rascunho e emitir: salvar rascunho apenas força a conclusão da fila do workspace; emitir executa a ação clínica explícita de criação/finalização já existente. O ditado iniciado no novo exame conserva o identificador clínico criado explicitamente e, após recarga, finaliza esse mesmo rascunho por PUT, sem um segundo POST clínico. Fechar logicamente o workspace somente depois de sucesso confirmado; nunca emitir por autosave.
7. Cobrir recarga, falha de rede, repetição da mesma operação, alteração durante salvamento, múltiplas abas, troca de usuário/contexto, carregamento tardio e emissão com salvamento pendente. Confirmar preservação de laudos emitidos, portal, cadastros e efeitos externos. Não repetir automaticamente a emissão como se fosse PUT de workspace.
8. Testar integração no formulário real de novos exames com dados sintéticos; executar verificações de tipos, lint, build e guardrail SDD pertinentes. Registrar resultado e limitações em `verify.md`, sem antecipar aprovação de testes não executados.

## Fase 1b — Edição de laudos existentes (posterior à 1a)

1. Estender o workspace privado ao contexto de um laudo existente, com revisão da versão clínica de origem e controles específicos de concorrência e acesso.
2. Recuperar alterações em elaboração sem rebaixar status, substituir PDF, sincronizar portal ou alterar cadastros automaticamente. Preservar o documento existente até ação clínica explícita.
3. Cobrir o ditado e a retomada pela rota de edição de um laudo existente. A fase 1a cobre apenas o ditado iniciado no formulário novo e sua continuidade por workspace, sem comprovar proteção da rota `/laudos/{id}/editar`.
4. Fechar critérios específicos e concluir os testes antes de iniciar a fase 2.

## Fase 2 — Conferência e prévia do PDF

1. Consolidar avisos existentes em uma conferência compacta, com acesso direto aos campos que precisam de revisão.
2. Renderizar uma prévia real do PDF a partir do conteúdo revisado, ainda sem emissão ou liberação. Diferenciar a prévia do documento emitido.
3. Conferir consistência entre o conteúdo apresentado, o conteúdo revisado e o conteúdo enviado na emissão, incluindo medidas, métodos, conclusão e imagens.
4. Validar ausência de efeitos no portal e em documentos anteriores, estados de erro/recuperação e funcionamento em computador e tela pequena.

## Fase 3 — Editor focado e identificação das páginas

1. Recolher manutenção de frases/presets em uma área de gerenciamento, preservando as funções existentes.
2. Disponibilizar filtros de campos alterados/pendentes/todos e manter a conclusão acessível, sem considerar automaticamente um campo preenchido como clinicamente conferido.
3. Acrescentar identificação do paciente/exame/documento e paginação ao PDF a partir do contexto da versão emitida, sem usar alterações futuras de cadastro como dados históricos.
4. Validar legibilidade, navegação por teclado, telas pequenas, impressão e ausência de sobreposição nos rodapés.

## Fase 4 — Síntese clínica e comparação no PDF

1. Detalhar a indicação breve do exame e a organização da conclusão em achado principal, repercussão e correlação/acompanhamento quando pertinentes, sempre revisáveis pelo veterinário.
2. Reaproveitar a comparação histórica já existente e seus controles de identidade, data, unidade, técnica e vista.
3. Permitir inclusão opcional de um quadro comparativo no PDF após revisão explícita. Diferenças numéricas não produzem diagnóstico ou afirmações automáticas de melhora/piora.
4. Preservar conclusão inicial, narrativa completa, bibliografia e acesso ao exame original; validar exemplos caninos/felinos e ausência de histórico comparável.

## Fase 5 — Imagens principais

1. Facilitar marcar e ordenar poucas imagens representativas para aparecerem primeiro, com as demais no conjunto de imagens.
2. Aproveitar legendas e rótulos de origem explícitos, mantendo edição manual. Não inferir vista, fase ou diagnóstico de forma não confirmada.
3. Validar proporção, legibilidade, arquivo indisponível, imagens de tamanhos distintos e correspondência entre seleção, ordem e PDF.

## Avaliação do resultado

Comparar, em testes sintéticos e depois na homologação autorizada, tempo de confecção, necessidade de reconstrução após interrupção, quantidade de ações na revisão e correções após emissão. Contagens de campos preenchidos não equivalem a qualidade clínica. Não incluir dados pessoais em telemetria ou evidências de teste.
