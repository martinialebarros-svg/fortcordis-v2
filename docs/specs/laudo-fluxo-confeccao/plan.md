# Plan — Fluxo de confecção do laudo ecocardiográfico

## Restauração planejada de stage após a promoção de04/11/2026

Este ramo prepara a **restauração completa de stage** a partir do backup `1a5b444a`. Os registros abaixo sobre recorte e exclusão de HP descrevem o snapshot destinado a produção na PR549; não redefinem o conteúdo de stage restaurado. Stage recupera HP, comparação anterior, Gestão e demais recursos do backup, com suas fontes, testes e documentos completos. Produção permanece restrita à conferência/prévia e dependências autorizadas. A salvaguarda de Nginx e a evidência desta publicação são mantidas. Cache eco v35 distingue o renderer completo de stage do renderer v34 do recorte; PA não muda. Nenhuma tabela, frase, fórmula ou intervalo clínico é alterado por esta restauração. A instalação e o smoke da restauração serão registrados após resultado terminal.


## Promoção isolada autorizada —04/11/2026

Pedido humano atual: “Publique em produção a conferência final e a prévia do PDF do laudo.” A entrega inclui a fase1b de rascunho/atualização atômica **como dependência necessária e explícita da prévia na edição**, usada na homologação do caso sintético63. A fase1a já está em produção. O recorte parte de main3f134432 e reaplica os commits funcionais49ca4381/a5ed822a/e541de8c, resolvendo contextos contra o baseline de produção. Nenhuma migração nova:105 já integra main.

Ficam fora do recorte: Gestão/migração101, comparação anterior, classificação/avisos de HP, novas faixas de referência e mudanças de WhatsApp/egress/host-routing que só estão em stage. As fórmulas, fontes e faixas de produção são conservadas. Duas correções de revisão integram o recorte: retirar o espaçador terminal quando não há imagens e usar a normalização exata de espécie já existente no backend para os índices. O cache de eco recebe identificador v34 para não servir um PDF v32 com página vazia; PA não muda. O helper de avisos usa o normalizador já existente em main; a dependência opcional de HP foi retirada. Viewer/hook/painel e seis respectivos testes permanecem byte idênticos ao corretivo e541de8c homologado. O literal de espécie cadastrado é preservado; apenas as decisões de cálculo/apresentação usam o normalizador compartilhado.

Stage completo1a5b444a será preservado por ref antes da substituição temporária por um snapshot isolado. A promoção permanece pelo PR protegido direto stage→main, após CI/deploy/homologação do recorte. Depois, restaurar o conteúdo completo de stage com ancestry de main, preservando a salvaguarda operacional e os registros. Não publicar os módulos excluídos nem usar cherry-pick/PR de feature direto em main.

A salvaguarda documentada em deploy-preserve-nginx seleciona ENABLE_NGINX_HTTP2=0 e RELOAD_NGINX_ON_DEPLOY=0 apenas para o SHA cujo commit contém [preserve-nginx]. O merge final em main deverá portar esse marcador. Não altera nginx.conf, TLS/CSP, flags do Atendimento ou os defaults das demais publicações.

O histórico abaixo registra autorizações e validações anteriores; limites antigos de publicação somente local/stage são substituídos apenas pela autorização atual deste recorte. Evidências do recorte e da instalação serão registradas sem converter testes locais ou do stage completo em prova de produção.


## Estratégia de entrega

Entregar incrementos pequenos e verificáveis. Cada fase deve preservar o preenchimento clínico existente e ter critérios próprios de aceitação. Preparar e validar localmente; publicação em stage e promoção a produção exigem o pedido correspondente e a verificação da versão efetivamente instalada.

## Fase 1a — Novos ecocardiogramas: rascunho e recuperação (entregue)

Fase 1a e correção do lote de imagens publicadas em produção pela PR #539 (`4f6a11ba`); stage restaurado pela PR #540 (`2fef8bb1`). Os passos abaixo preservam o roteiro executado e suas decisões. Resultados e limites estão em `verify.md`; este registro histórico não foi revalidado por acesso remoto no ciclo atual.

1. Conferir criação de laudo, importação, autenticação e sessão de imagens; restringir o delta ao formulário de novos ecocardiogramas. Usar a worktree isolada `codex/echo-draft-recovery-20261101`, baseada em `origin/stage`, preservando alterações alheias e o editor de laudos existentes.
2. Implementar workspace privado no servidor, independente de `Laudo` e de cadastros. Expor leitura por GET, gravação por PUT com revisão esperada (CAS) e identificador de operação para repetição, e fechamento lógico por POST também condicionado à revisão. Exigir `X-Editor-Owner-Id` e conferir sua correspondência com a identidade autenticada nas três operações, sem tratá-lo como credencial. Preservar o workspace até fechamento lógico; não apagar registros clínicos.
3. Definir um snapshot bruto recuperável com medidas, proveniência, métodos/ondas, qualitativa, conclusão, observações, dados de contexto e descritores das imagens já recebidas. Excluir `File`, binários, previews/data URLs e credenciais. Manter somente UUID opaco em `sessionStorage`, isolado por usuário e contexto de origem da URL, não pelos campos vazios iniciais. A primeira fatia descobre o workspace somente enquanto a referência existir na aba/sessão; não implementar lista de rascunhos nem prometer recuperação após fechar a aba ou trocar de dispositivo.
4. Após concluir a inicialização do contexto de origem, consultar o workspace e oferecer recuperação explícita. Enquanto a decisão de recuperar estiver pendente, não salvar o formulário vazio sobre o conteúdo existente. Vincular a montagem ao primeiro usuário conhecido e bloquear sua continuidade se a identidade mudar ou desaparecer; sem usuário identificável, bloquear ditado e emissão de novo eco. Usar debounce inicial de 1.500 ms, fila de gravações e proteção de respostas antigas; não reaplicar padrões sobre confirmações recuperadas. Voltar e cliques comuns em links internos da mesma aba devem concluir a fila antes da navegação; em falha, conservar a tela. A proteção `beforeunload` cobre saída nativa; botão Voltar do navegador e navegação programática externa não estão interceptados nesta fatia.
5. Recuperar imagens temporárias consultando os identificadores da sessão já recebidos pelo sistema. Respeitar a validade existente de 24 horas, conferir disponibilidade e pedir reenvio das ausentes. Revalidar as imagens temporárias antes da emissão e conferir o conjunto esperado por quantidade e metadados no laudo depois da associação. Resposta HTTP bem-sucedida, isoladamente, não comprova associação de todas as imagens esperadas. Recuperação do workspace não estende nem comprova a existência das imagens.
6. Separar as ações de salvar rascunho e emitir: salvar rascunho apenas força a conclusão da fila do workspace; emitir executa a ação clínica explícita de criação/finalização já existente. O ditado iniciado no novo exame conserva o identificador clínico criado explicitamente e, após recarga, finaliza esse mesmo rascunho por PUT, sem um segundo POST clínico. Fechar logicamente o workspace somente depois de sucesso confirmado; nunca emitir por autosave.
7. Cobrir recarga, falha de rede, repetição da mesma operação, alteração durante salvamento, múltiplas abas, troca de usuário/contexto, carregamento tardio e emissão com salvamento pendente. Confirmar preservação de laudos emitidos, portal, cadastros e efeitos externos. Não repetir automaticamente a emissão como se fosse PUT de workspace.
8. Testar integração no formulário real de novos exames com dados sintéticos; executar verificações de tipos, lint, build e guardrail SDD pertinentes. Registrar resultado e limitações em `verify.md`, sem antecipar aprovação de testes não executados.

## Fase 1b — Edição de laudos existentes (homologação central aprovada em stage)

Em 02/11/2026, o usuário autorizou publicar em stage e testar com conteúdo sintético. A PR #541 foi instalada como `89b58cb498dec9fab6ae856e51b8301435f93f99`, com workflow terminal aprovado. Autosave privado, recuperação, atualização única do sintético #61, PDF renderizado, conflito e reabertura da edição na mesma aba foram conferidos; o smoke básico de teclado/390 × 844 foi aprovado. A limpeza final também foi concluída: após reautenticar a sessão expirada, Descartar foi acionado uma vez e o diálogo nativo confirmado por Return; a UI voltou ao #61 com Revisão 3 e Finalizado intactos. O reset do viewport teve sucesso, com DOM em 504 × 774, tamanho normal atual do painel. O bloqueio inicial do diálogo e o primeiro reset expirado ficam preservados em `verify.md`. Produção não foi autorizada para a fase 1b. O fechamento de evidências permanece local, sem nova publicação de código idêntico.

1. Preparar a entrega na branch `codex/echo-existing-draft-recovery-20261101`, baseada em stage restaurado `2fef8bb1`. O limite inicial era local; a autorização de 02/11 ampliou o ciclo para commit/publicação e testes em stage. Conferir o carregamento e a atualização do editor existente, o ditado, a persistência de imagens e os efeitos em paciente/tutor/portal, preservando as evidências.
2. Definir uma revisão opaca emitida pelo servidor, `echo-v1:<hash>`, para a origem clínica. Usar `editor: existing-echo`, contexto `edit:laudo:<id>` e `source: {laudo_id, editor_revision}`. A revisão de origem clínica e a revisão CAS do workspace têm funções distintas; origem e sessão de temporários não podem ser trocadas no mesmo workspace.
3. Estender o workspace privado, preservando os contratos da fase 1a de proprietário, sessão, limites, fila, retry e fechamento. Inicializar a base completa antes de consultar/restaurar o workspace. Conservar medidas literais, unidades, métodos/ondas, derivação, textos, estados de aplicação e imagens; não fabricar confirmações ao recuperar.
4. Tornar “Salvar rascunho” e autosave exclusivamente privados. Digitação, importação, sugestões de ditado e alterações de imagens persistidas não devem chamar atualizações clínicas ou modificar o documento emitido. Erro de rascunho mantém a edição local e bloqueia a atualização clínica até resolução.
5. Disponibilizar atualização explícita pelo PUT dedicado `/laudos/{id}/editor-update`. Validar usuário, acesso, origem e CAS antes de efeitos; efetivar campos/imagens previstos, recibo da operação e fechamento do workspace em uma única transação, usando os mecanismos da migração 105. Manter compatibilidade do PUT legado, sem nova migração 106 prevista. Uma falha de recebimento da resposta não autoriza repetir a atualização clínica.
6. Detectar alteração da origem por outra aba/operador, impedindo sobrescrita por revisão antiga. Conservar a source e o rascunho, sem mescla automática. Congelar a intenção usada no flush e no corpo clínico; persistir seu guard antes do apply. Em sucesso estritamente confirmado, aposentar o ponteiro local sem repetir close e permitir nova edição. Na resposta incerta, GET 410 existente conserva resultado/encaminhamento e UUID até conferência explícita. Permitir descarte privado com confirmação e close CAS da revisão conhecida, sem flush vazio, apenas quando não houver tentativa pendente/confirmada; a próxima edição começa na versão oficial atual. Diferenciar os códigos 409 de origem, imagens, workspace, vínculo, operação e temporários reparáveis.
7. Separar imagens já persistidas de arquivos temporários. Legenda, ordem, inclusão e remoção de imagem persistida ficam locais/workspace até atualização explícita, com validação de pertencimento ao laudo. Vincular sessão e IDs temporários recebidos aos descritores do workspace; não aceitar sessão de outra cópia. Recuperar temporários disponíveis, respeitar 24 horas e permitir remover/reenviar os ausentes sem falso conflito da origem. Conferir o conjunto após a atualização; não repetir criação/atualização para reparar associação incerta.
8. Reutilizar o identificador existente no ditado, sem criar outro laudo nem rebaixar status para preparar o assistente. Aplicar sugestões apenas ao formulário/workspace até confirmação clínica. Isolar todos os callbacks assíncronos por laudo/rota, geração, usuário e sessão; renovar a sessão de upload ao mudar o laudo. Cobrir recarga, navegação com flush e seus limites de Browser Back/programação externa.
9. Executar testes sintéticos locais de preservação do documento/status/PDF/portal/cadastros, concorrência clínica e CAS do workspace, retry/recibos, recuperação literal, imagens persistidas/temporárias, ditado, falhas parciais, resposta incerta, navegação e regressão da fase 1a/PA/consumidores do uploader. Conferir teclado, viewport estreito, tipos, lint, build e guardrail SDD conforme o delta final; atualizar a matriz `ID | Status | Evidência` somente com resultados executados.
10. Concluir a homologação autorizada e os critérios da fase 1b antes de iniciar a fase 2. Promoção a produção da fase 1b continua dependente de solicitação própria e do protocolo de publicação; os resultados da fase 1a não substituem provas dessa nova implementação.

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


## Execução local da fase 2 — autorizada em 03/11/2026

1. Preservar os quatro documentos pós-homologação e `output/` existentes; reutilizar a worktree deste chat, branch `codex/echo-pdf-preview-20261103` baseada em stage45f06fee. Nenhuma mudança remota. Janela deste chat cedida ao Atendimento para ativação separada; aguardar seu encerramento antes de futuro deploy concorrente.
2. Compartilhar renderização canônica e implementar projeção de prévia somente leitura, vinculada a owner/workspace/revisão e imagens da mesma origem. Sem migração; rollback remove apenas rota/componente novos e preserva fluxos entregues.
3. Implementar painel/hook compartilhados e reutilizar construtores de payload na integração das duas páginas. Cancelamento, snapshot e ciclo de objectURLs ficam isolados do autosave/emissão.
4. Executar regressões de segurança/efeitos, paridade real de PDF, avisos e async UI, seguidas dos checks pertinentes. Usar somente SQLite/arquivos temporários/sintéticos locais; nenhuma chamada paga, mensagem, dado clínico ou runtime remoto.
5. Renderizar/inspecionar PDFs e interface desktop/estreita. Registrar resultados exatos e limitações, sem declarar stage/produção como aprovados por testes locais.

EGM foi sugerido como revisão opcional da especificação, mas não explicitamente solicitado; não executar neste incremento.


### Resultado da implementação da fase 2 — 03/11/2026

- Rota de prévia implementada em `laudo_editor_drafts.py`, schema e projeção somente leitura em `echo_pdf_preview.py`. Reutiliza `render_echo_pdf_content` do PDF oficial/portal e marca cada página. Confere owner, visualizar+editar, revisão da origem e imagens completas da mesma sessão/laudo. Não usa rollback de uma mutação para simular prévia.
- Painel compartilhado em novo/edição, avisos orientativos e navegação com foco. Construtores oficiais reutilizados por prévia/emissão; metadado de serialização estruturada estabilizado enquanto o conteúdo não muda. Autosave privado pode concluir antes da prévia; documento oficial não é atualizado.
- Hook isola respostas por snapshot/contexto, cancela/descarta pedidos antigos e libera URLs. Digitação não gera PDFs. Guards de emissão, conflito, recuperação e resposta incerta conservados.
- Iframe nativo inicial ficou vazio no IAB. Substituído no mesmo ciclo por PDF.js já instalado, carregado sob demanda com worker empacotado, uma página por vez, navegação e cleanup. CUA verificou o PDF real visível e páginas1–3, teclado e390px sob CSP idêntica ao Next, sem enfraquecê-la.
- Casos sintéticos reproduzíveis em `output/echo-preview-pdf-20261103/`: canino HP confirmada/pendente e felino com fusão E/A, cada um com três páginas, catálogo/diastólica, unidades, fontes e imagem/legenda. Todos renderizados e inspecionados. Harness UI usa uma fixture PDF fixa e está explicitamente rotulado; prova responsividade/interações, não paridade do payload, que é testada por HTTP.
- QA local encerrada, aba temporária fechada, viewport restaurado e porta3557 fechada. Não houve nova migração, dado real, chamada paga, mensagem, escrita remota, commit, push ou publicação. Resultados finais/checks e limitações da suíte geral estão em `verify.md`.


### Janela do Atendimento encerrada — 03/11/2026

Aviso explícito recebido e relatório responsável conferido; GitHub41578561817/41579081548 completed/success, refs main3f134432/stage45f06fee preservados. A espera deste chat está encerrada. Segundo o relatório, o estado intencional autorizado do Atendimento é IA ON persistente em produção e OFF em stage; não restaurar o OFF histórico. Nenhum novo deploy ou teste pago foi feito por laudos. A publicação/homologação da fase2 continua dependente do pedido próprio e preflight vigente; essa coordenação não a autoriza. Detalhe/proveniência na nota Obsidian deste chat de03/11.


## Publicação autorizada da fase 2 — stage,03/11/2026

Pedido humano “publique”, após proposta explícita de stage. Fila consultada sem execuções em andamento/queued, refs stage45f06fee/main3f134432; janela do Atendimento concluída. Preparar commit apenas dos19 arquivos de código da fase2 e dos quatro SDD laudo-fluxo-confeccao, deixando HPplan/verify e output preservados fora do snapshot. Revalidar SDD/diff/hashes e checks; PR base stage, merge com head aprovado e refstage rechecado, aguardar todos os workflows terminais. Conferir logs de SHA instalado/runtime/migrações/canário/restore e smoke domínio/assets/API. QA autenticada somente com novo exame sintético; produção sem publicação e sem mudança de Atendimento/Nginx. Não usar marcadores de canários IA/ingress de outro projeto.


### Correção descoberta na homologação de stage —03/11/2026

PR #546 instalada no SHA873a94a5 com gates/workflows aprovados. Rascunho recuperado e PDF canônico válido; PDF.js falhou na leitura XHR da URL blob. Reprodução no Next compilado confirmou falha status0 por URL e sucesso dos mesmos bytes como Uint8Array. Entregar Blob validado ao visualizador, criar bytes próprios por tentativa e conservar cancelamento/isolamento/revogação/link, sem relaxar CSP ou alterar conteúdo clínico. Testar regressões e componente real compilado, publicar correção por PR base stage e concluir QA autenticada sintética antes de encerrar. Produção continua fora da autorização.

Corretivo implementado nos três componentes/hooks e três testes:31foco e2789globais+23Node, lint/tipos/build aprovados; revisão independente sem bloqueadores. Next compilado real exibiu1→3 viaCUA. Preparar PR stage e aguardar CI/deploy, sem promover produção.


### Encerramento de QA autorizada em stage —03→04/11/2026

Após retorno do controle do navegador e pedido explícito do usuário, a prévia instalada e a atualização sintética63 foram conferidas. PDF.js1→3, teclado/390px, invalidação/índice, edição+recuperação com oficial intacto, atualização única no mesmoID e PDF revisão2 correspondente à prévia passaram; reabertura sem recuperação antiga confirmada. Substitui a pendência de homologação remota do viewer acima, no escopo e com os limites de verify/qa63-final. Sem novo código/deploy ou produção.


### Registro documental de exclusão de HP

O guardrail SDD exige a estrutura de uma feature tocada mesmo quando seu código é temporariamente retirado. O snapshot mantém somente quatro documentos mínimos de eco-probabilidade-hipertensao-pulmonar que registram a exclusão. Não há implementação/avisos/referências/testes de HP na promoção, nem critério clínico declarado aprovado nesses documentos. Os documentos completos, assim como o código, estão no backup1a5b444a e serão restaurados em stage. Guardrail não foi alterado nem recebeu exceção.


### P2 da revisão de isolamento — corrigidos e validados em04/11/2026

Os dois comportamentos já existiam no baseline main e foram percebidos pela revisão como diferenças contra o stage completo. A decisão de corrigi-los é explícita neste recorte, pois afetam o PDF e a coerência da prévia/edição; não se promove a auditoria completa de referências nem a classificação HP.

1. PDF: fixture sem imagens reproduziu duas páginas, a última apenas com rodapé. Espaçador5mm agora pertence somente à seção de imagens. A mesma fixture gera uma página em oficial e prévia, com texto/pixels da primeira página preservados. Cache de eco v34 invalida v32; cache de PA continua igual. Sete páginas com imagens dos três fixtures representativos continuam idênticas ao baseline main por texto/geometria/pixels.
2. Espécie: reproduzidas sete falhas com Dog/Cão/cachorro, incluindo payload com índice0,9 desatualizado após alterarDIVEd25→30mm. Cinco pontos de fonte usam o normalizador exato já existente: apresentação, derivação Cornell, gate2D e predicados das páginas novo/editar. Nenhuma fórmula0,294/0,316, fonte, faixa, domínio, vista ou unidade foi mudada. Literal cadastrado preservado; CaninaXYZ/Dogfish/felinos não recebem índice canino. Regressões cobrem formulário/payload, detalhe e argumentos da comparação de referências.

Validação terminal após as correções: backend2469 testes+2422subtestes,175skips/25warnings,137,83s, papelapi e bloqueio externo; frontend2581Vitest/147arquivos+23Node, tipos/lint/build aprovados; foco193 sobreposto. Backend foco124+428subtestes e13+26subtestes também aprovado. Revisão independente de ambas correções sem achados acionáveis. PostgreSQL4/4 anterior permanece prova do módulo transacional que não mudou nesses P2. Logs/regressões em output/echo-preview-prod-20261104/backend/footer-boundary e output/echo-preview-frontend-20261104/alias-validation.json.

As afirmações de paridade byte a byte de nove arquivos com main e renderer v32 nos registros anteriores se referem ao snapshot antes desses ajustes; não descrevem a fonte final corrigida. A paridade dos seis arquivos de viewer/painel/hook com e541de8c continua válida.


### Fechamento do seletor de método AE/Ao —04/11/2026

A revisão apontou um terceiro gate de espécie literal em ReferenciaComparison: o seletor canino de método AE/Ao ficava oculto para Dog/Cão/cachorro e aparecia indevidamente para CaninaXYZ. O import/predicado usa agora o mesmo normalizeEchoSpecies já produtivo. A seleção permanece explícita, altera somente AE_Ao_metodo e não reescreve espécie nem confirma aquisição automaticamente. Gates que operam a espécie canônica do catálogo continuam preservados.

Regressões reproduziram quatro falhas antes do ajuste e agora cobrem quatro aliases e seis controles desconhecidos/felinos; foco107 aprovado, com seleção/callback único/rerender e objetos/literal preservados. Frontend final2591Vitest/147arquivos+23Node, tipos/lint/build53 e diffcheck aprovados. Backend fonte e resultados2469+2422 permanecem inalterados por este ajuste de UI. Revisão independente sem achados; não há fórmula/faixa/fonte nova. Evidência aeao-alias-validation.json e logs próprios no output/echo-preview-frontend-20261104.
