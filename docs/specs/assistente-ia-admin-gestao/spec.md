# Spec - assistente-ia-admin-gestao

Data: 2026-07-23
Responsavel: Martiniano + Codex
Status: completed

## 1) Escopo funcional

Disponibilizar a Mente FortCordis somente ao administrador como copiloto de gestao e apoio clinico. O modelo opera exclusivamente por ferramentas deterministicas e estritas. Consultas podem responder imediatamente; qualquer escrita operacional e preparada, exibida ao admin e executada apenas depois de aprovacao com revalidacao.

## 2) Requisitos funcionais

- RF-001: todas as rotas `/api/v1/assistente-ia` exigem `require_papel("admin")` no backend.
- RF-002: conversas, mensagens, ferramentas e acoes permanecem associadas ao administrador proprietario.
- RF-003: faturamento, agenda, disponibilidade e debitos continuam usando as fontes oficiais e dados minimizados.
- RF-004: o resumo executivo consolida agenda do dia, reservas proximas do prazo, faturamento recebido no mes, contas vencidas e aprovacoes pendentes.
- RF-005: criacao/reserva, exclusao, funcionamento excepcional, remarcacao, cancelamento, bloqueio/liberacao e WhatsApps geram acao `pending` com TTL.
- RF-006: aprovar uma acao revalida proprietario, status, expiracao, snapshot e regras atuais antes da escrita.
- RF-007: remarcacao reutiliza `agenda.atualizar_agendamento`; cancelamento reutiliza `agenda.atualizar_status`; WhatsApps reutilizam `clinicas.atualizar_whatsapps_clinica`.
- RF-008: bloqueio de agenda possui intervalo, motivo, autor e estado ativo; conflito impede criacao e aprovacao.
- RF-009: bloqueios ativos removem slots tanto de `_validar_slot_disponivel` quanto de `sugerir_horarios_agenda`.
- RF-010: a caixa central lista todas as acoes pendentes do admin, independentemente da conversa.
- RF-011: memoria proposta pela IA nasce `pending`; somente memoria `approved` entra nas instrucoes de novas respostas.
- RF-012: memoria cadastrada diretamente pelo admin pode entrar aprovada, com origem e auditoria preservadas.
- RF-013: documentos internos entram somente por inclusao explicita do admin, com hash para deduplicacao, fonte, categoria e arquivamento.
- RF-014: a pesquisa interna retorna apenas trechos relevantes e identificacao da fonte, nunca toda a base indiscriminadamente.
- RF-015: o copiloto clinico pode obter o laudo atual e ate cinco anteriores do paciente.
- RF-016: sugestoes clinicas sao salvas em `assistente_ia_rascunhos_clinicos`; o `laudo` oficial nao e alterado ou finalizado.
- RF-017: cada resposta da Mente aceita feedback positivo/negativo e, no negativo, correcao esperada opcional.
- RF-018: mensagens do assistente registram tokens, latencia, status e `provider_response_id` sem armazenar segredos ou raciocinio interno.
- RF-019: a interface possui conversa, resumo diario, aprovacoes, memoria, conhecimento e rascunhos clinicos.
- RF-020: casos de avaliacao versionados cobrem roteamento, aprovacao e proibicao de escrita generica/finalizacao clinica.
- RF-021: o radar proativo compara faturamento, agenda, cancelamentos, debitos, reservas e aprovacoes, persistindo cada leitura sem executar escrita operacional.
- RF-022: missoes recorrentes aceitam somente os tipos de leitura `radar`, `executive_summary`, `billing_trend`, `overdue_debts` e o laboratorio isolado `eval_lab`.
- RF-023: recorrencia usa agenda diaria ou semanal tipada, horario local `America/Fortaleza`, proxima execucao persistida e lock distribuido no PostgreSQL.
- RF-024: remover o papel `admin` do proprietario interrompe a execucao e pausa a missao recorrente.
- RF-025: documento so entra na memoria semantica por opt-in explicito do admin e com fonte obrigatoria; sem opt-in, a busca lexical continua disponivel.
- RF-026: a indexacao envia somente o documento explicitamente selecionado para embeddings, guarda vetores e trechos localmente e registra estado `queued/indexing/ready/error`.
- RF-027: a pesquisa interna combina relevancia lexical e semantica, limita resultados e devolve titulo, categoria, trecho e fonte.
- RF-028: o laboratorio executa o dataset versionado contra o modelo atual, registra ferramenta esperada/selecionada e nunca chama a implementacao das ferramentas.
- RF-029: radar, missoes, indexacao e avaliacoes compartilham execucoes persistentes com origem, status, entrada, saida, erro e timestamps.
- RF-030: a interface administrativa possui areas dedicadas para Radar, Missoes e Avaliacoes e mostra o estado da indexacao semantica.
- RF-031: o contrato de roteamento distingue rascunho sem conteudo, que carrega primeiro o contexto do laudo, de rascunho completo, que pode ser salvo diretamente na area isolada.
- RF-032: remarcacao com alvo, data e horario definidos usa a ferramenta governada mesmo sem justificativa adicional; nesse caso o unico motivo permitido por padrao e `Solicitacao do administrador`.
- RF-033: o laboratorio exige uma chamada de ferramenta, explicita que `solicitar_*` apenas cria acao pendente, reserva orcamento suficiente para o roteamento estrito e registra o motivo quando o provedor nao selecionar ferramenta.
- RF-034: feedback negativo com correcao esperada cria uma sugestao de aprendizado `pending`, vinculada a resposta e ao contexto minimo da solicitacao, sem alterar a memoria ativa.
- RF-035: sugestoes manuais e originadas por feedback podem criar nova memoria ou apontar explicitamente para uma memoria aprovada existente.
- RF-036: o administrador pode revisar titulo, conteudo e categoria antes de aprovar ou rejeitar uma sugestao; somente a aprovacao altera o contexto da Mente.
- RF-037: cada criacao, ajuste ou restauracao aprovada gera uma versao imutavel em `assistente_ia_memoria_versoes` e atualiza `versao_atual`.
- RF-038: uma versao anterior pode ser restaurada, mas a restauracao sempre cria uma nova versao e preserva todo o historico.
- RF-039: cada estado vigente de memoria aprovada possui um unico contrato de regressao ativo com versao e hash esperados; contratos substituidos sao arquivados.
- RF-040: o laboratorio automatico combina os casos versionados de roteamento com contratos deterministas de memoria, sem chamar ferramenta nem executar escrita operacional.
- RF-041: a interface administrativa oferece fila de aprendizados, edicao antes da decisao, contadores, origem da correcao, contratos ativos, versoes e restauracao.
- RF-042: o mapa Clinicas 360 consolida ao vivo cada clinica a partir de cadastro, agenda, transacoes recebidas, ordens de servico, contas a receber e memorias aprovadas.
- RF-043: todo perfil compara um periodo de 30 a 365 dias com o intervalo imediatamente anterior de mesma duracao e identifica quando nao existe base comparavel.
- RF-044: os alertas de queda de faturamento, cancelamento elevado, debito vencido e inatividade usam limiares deterministicos expostos pelo contrato, sem inferencia oculta.
- RF-045: listagem, perfil e comparacao mostram periodo, data de geracao, data-limite, fontes, contagem de registros e ultima atualizacao disponivel.
- RF-046: o mapa pode exibir contatos institucionais da clinica, mas nunca retorna nome, contato ou identificador de paciente ou tutor.
- RF-047: a comparacao aceita de duas a dez clinicas, preserva os mesmos indicadores individuais e informa que o ranking vale apenas para a selecao.
- RF-048: a conversa possui ferramentas estritas para perfil e comparacao 360, resolvendo nomes pelos cadastros ativos e permanecendo somente leitura.
- RF-049: cada alerta suportado do perfil focal gera um plano deterministico com alerta de origem, prioridade, objetivo, evidencia e passos tipados.
- RF-050: os passos permitidos sao `read_only_mission`, `contact_draft` e `operational_review`; todos declaram ausencia de envio externo e de escrita automatica de negocio.
- RF-051: a missao sugerida usa o novo tipo `clinic_360`, aceita apenas clinica e periodo de 30 a 365 dias e executa somente a consulta do perfil vivo.
- RF-052: criar a missao sugerida exige uma segunda confirmacao explicita no cartao do plano; cancelar a revisao nao persiste nada.
- RF-053: contato sugerido abre apenas um pedido de rascunho na conversa e nunca dispara WhatsApp, e-mail ou outra notificacao.
- RF-054: revisao operacional abre um pedido delimitado na conversa; se resultar em escrita, o fluxo existente deve criar acao pendente e aguardar aprovacao.
- RF-055: portfolio e comparacao retornam apenas resumo da quantidade de planos, enquanto o perfil focal e a ferramenta `consultar_clinica_360` recebem o plano completo.
- RF-056: a resolucao de clinicas aceita pequenas diferencas de digitacao, acentuacao, pontuacao ou transposicao apenas quando o melhor cadastro ativo supera limiar e margem de confianca; aproximacoes ambiguas continuam exigindo esclarecimento.
- RF-057: a rota `POST /api/v1/assistente-ia/voz/transcrever` recebe audio limitado e suportado, exige `admin` e usa transcricao em portugues com vocabulario contextual de termos FortCordis e nomes de clinicas ativas.
- RF-058: a transcricao preenche o campo da conversa para revisao; ela nao e enviada automaticamente, nao cria conversa e nao aciona ferramenta antes do comando explicito de envio.
- RF-059: o audio bruto nunca e persistido pela FortCordis; a auditoria registra somente metadados operacionais, sem audio ou conteudo transcrito.
- RF-060: comandos originados por voz percorrem o mesmo `/chat`, as mesmas ferramentas estritas e as mesmas confirmacoes de qualquer comando digitado.
- RF-061: a interface oferece gravar, parar, transcrever, revisar e enviar, com limite automatico de duracao, estados acessiveis e mensagem de uso seguro.
- RF-062: `analisar_servicos_realizados` soma OS por `data_atendimento`, pagas ou pendentes, exclui `Cancelado`, aceita toda a FortCordis ou uma clinica e separa o indicador de recebimentos financeiros.
- RF-063: `consultar_deslocamento_clinicas` resolve origem e destino, reutiliza a matriz logistica oficial e devolve distancia, duracao, perfil e fonte como estimativa operacional.
- RF-064: `consultar_funcionamento_agenda` responde pelo horario geral efetivo de uma data usando excecao, feriado ou rotina semanal, sem exigir clinica ou servico.
- RF-065: `solicitar_vinculo_paciente_reserva` prepara uma acao pendente para associar paciente e tutor existentes a uma reserva ativa, sem cancelar, recriar ou mudar o horario.
- RF-066: a aprovacao do vinculo revalida proprietario, TTL, snapshot da reserva, expiracao, paciente, tutor e versoes; divergencia invalida a acao.
- RF-067: quando o provedor falhar depois de persistir um comando, a conversa e devolvida ao frontend, o texto volta ao campo e a nova tentativa identica reutiliza a mensagem sem resposta.
- RF-068: no mobile vertical, a coluna da conversa usa faixa explicita `minmax(0, 1fr)` e titulo, orientacao, exemplos, mensagens e campo de entrada respeitam a largura disponivel sem exigir rotacao do aparelho.

## 3) Requisitos nao funcionais

- NFR-001 (seguranca): sem SQL, shell, credenciais, endpoint generico ou escrita arbitraria exposta ao modelo.
- NFR-002 (autorizacao): ocultar UI nao substitui o guard `admin` do backend.
- NFR-003 (concorrencia): acoes usam snapshot, TTL, lock quando o fluxo oficial oferece e invalidacao em divergencia.
- NFR-004 (privacidade): ferramentas retornam o minimo; disponibilidade nao inclui paciente, tutor ou telefone.
- NFR-005 (clinico): rascunho sempre informa que requer revisao e que o laudo oficial nao foi modificado.
- NFR-006 (memoria): conteudo pendente ou rejeitado nunca entra no prompt.
- NFR-007 (conhecimento): ingestao e arquivamento sao explicitos e exclusivos do admin; busca e limitada a dez trechos.
- NFR-008 (resiliencia): ausencia de chave ou falha do provedor retorna erro controlado sem comprometer os modulos de negocio.
- NFR-009 (custo): loop tem teto; tokens e latencia sao mensurados; avaliacao continua e versionada.
- NFR-010 (compatibilidade): Responses API, `previous_response_id`, SDK oficial e fluxos atuais permanecem a base da integracao.
- NFR-011 (autonomia segura): o scheduler nao possui ferramenta de escrita de negocio e nao transforma missao recorrente em prompt arbitrario.
- NFR-012 (rastreabilidade): todo alerta do radar inclui evidencia e recomendacao; toda recuperacao semantica preserva a fonte cadastrada.
- NFR-013 (isolamento de avaliacao): o laboratorio usa casos sinteticos, `store=false` e observa function calls sem enviar seus outputs para qualquer executor.
- NFR-014 (degradacao): falha de embeddings preserva a busca lexical; falha de uma execucao fica registrada sem afetar agenda, financeiro ou laudos.
- NFR-015 (segredos por ambiente): stage injeta somente `OPENAI_API_KEY_STAGE` e producao injeta somente `OPENAI_API_KEY_PROD` no `backend/.env` do ambiente correspondente, sem expor valores em logs ou frontend.
- NFR-016 (aprendizado supervisionado): nenhuma correcao, preferencia inferida ou feedback negativo muda automaticamente a memoria ativa.
- NFR-017 (reversibilidade): atualizacoes de memoria sao append-only no historico e a reversao nunca apaga versoes anteriores.
- NFR-018 (regressao segura): contratos de memoria usam somente identificador, versao e hash do conteudo aprovado; nao executam ferramentas nem carregam dados operacionais.
- NFR-019 (privacidade do portfolio): respostas de Clinicas 360 declaram e cumprem `contains_patient_or_tutor_data=false`.
- NFR-020 (proveniencia): nenhum indicador 360 e apresentado sem periodo, modo de leitura e fontes oficiais consultadas.
- NFR-021 (consistencia financeira): ordens pendentes e contas a receber permanecem separadas e o total combinado e rotulado como estimativa sem deduplicacao.
- NFR-022 (autonomia supervisionada): plano, missao, contato e revisao nao concedem ao scheduler nem ao modelo uma ferramenta generica de escrita.
- NFR-023 (explicabilidade): todo plano referencia um alerta e sua evidencia; nenhuma recomendacao usa score preditivo ou causa inferida de forma opaca.
- NFR-024 (minimizacao): os prompts sugeridos incluem apenas nome institucional, periodo e contexto gerencial do alerta, sem paciente ou tutor.
- NFR-025 (resolucao conservadora): correspondencia aproximada nunca vence uma ambiguidade por substring/token e exige vantagem minima sobre o segundo candidato.
- NFR-026 (privacidade de voz): nenhum byte de audio e gravado no banco, logs ou auditoria; somente a transcricao enviada pelo admin passa a integrar a conversa.
- NFR-027 (limites de upload): tipo, extensao, conteudo vazio e tamanho maximo sao validados no backend antes da chamada ao provedor.
- NFR-028 (segredo): a chave OpenAI permanece exclusiva do backend; o navegador envia audio somente ao dominio autenticado da FortCordis.
- NFR-029 (degradacao): navegador sem `MediaRecorder`, permissao negada ou falha de transcricao mantem a entrada por texto disponivel e retorna erro controlado.
- NFR-030 (fontes): producao por OS, recebimentos financeiros, debitos, funcionamento e deslocamento declaram fontes distintas e nao podem ser apresentados como equivalentes.
- NFR-031 (minimizacao): consultas de OS e deslocamento nao retornam paciente, tutor, telefone ou endereco.
- NFR-032 (retomada): falha temporaria nao deve apagar o comando digitado/transcrito nem criar repeticoes consecutivas no historico ao tentar novamente.
- NFR-033 (vinculo governado): nenhuma reserva recebe paciente antes da confirmacao e o fluxo oficial de atualizacao da agenda continua responsavel pela escrita e auditoria.
- NFR-034 (responsividade): a conversa deve permanecer legivel entre 320 e 430 CSS pixels, sem rolagem horizontal da pagina e sem recorte de texto, preservando o layout de duas colunas em desktop.

## 4) Persistencia

- existentes: `assistente_ia_conversas`, `assistente_ia_mensagens`, `assistente_ia_acoes_pendentes`;
- novos no copiloto: `assistente_ia_memorias`, `assistente_ia_conhecimento_documentos`, `assistente_ia_feedbacks`, `assistente_ia_rascunhos_clinicos`, `agenda_bloqueios`;
- novos na autonomia segura: `assistente_ia_conhecimento_trechos`, `assistente_ia_missoes`, `assistente_ia_execucoes` e colunas semanticas em `assistente_ia_conhecimento_documentos`;
- novos no aprendizado continuo: `assistente_ia_aprendizados`, `assistente_ia_memoria_versoes`, `assistente_ia_regressao_casos` e `assistente_ia_memorias.versao_atual`;
- migrations: `20260721_53_assistente_ia_copiloto.py`, `20260721_54_assistente_ia_autonomia.py` e `20260722_55_assistente_ia_aprendizado_supervisionado.py`.
- Clinicas 360 nao cria tabela ou migration: todos os indicadores sao calculados sob demanda sobre as fontes oficiais existentes.
- planos de acao tambem nao criam tabela ou migration; somente a missao aprovada reutiliza `assistente_ia_missoes` e `assistente_ia_execucoes`.
- voz e tolerancia de nomes nao criam tabela ou migration; audio nao e persistido e a transcricao so entra nas mensagens depois do envio do admin.
- as novas consultas, retomada e vinculacao reutilizam modelos, matriz logistica, mensagens e acoes pendentes existentes; nao ha nova migration.

## 5) Ferramentas

Leitura: `analisar_faturamento`, `localizar_agendamentos`, `verificar_disponibilidade`, `relatorio_debitos_pendentes`, `consultar_clinica_360`, `comparar_clinicas_360`, `gerar_resumo_executivo`, `listar_bloqueios_agenda`, `consultar_conhecimento_interno`, `obter_contexto_laudo`.

Preparacao/escrita governada: `solicitar_exclusao_agendamento`, `solicitar_criacao_agendamento`, `solicitar_excecao_funcionamento_agenda`, `solicitar_remarcacao_agendamento`, `solicitar_cancelamento_agendamento`, `solicitar_bloqueio_agenda`, `solicitar_liberacao_bloqueio_agenda`, `solicitar_atualizacao_whatsapps_clinica`, `propor_memoria_operacional`, `salvar_rascunho_clinico`.

`salvar_rascunho_clinico` grava somente na area isolada de rascunhos e nao e uma escrita no laudo oficial.

## 6) Criterios de aceitacao

- CA-001: todas as rotas da Mente possuem guard backend `admin`.
- CA-002: resumo diario e indicadores carregam sem exigir uma conversa.
- CA-003: novas acoes ficam pendentes, sao rejeitaveis e so escrevem apos confirmacao valida.
- CA-004: remarcacao/cancelamento/WhatsApps chamam fluxos oficiais e invalidam snapshot divergente.
- CA-005: bloqueio aprovado impede escrita e sugestao de slot sobreposto; liberacao restaura disponibilidade.
- CA-006: caixa central mostra acoes de todas as conversas e remove itens decididos.
- CA-007: memoria pendente nao orienta; memoria aprovada aparece no contexto da Mente.
- CA-008: documento duplicado ativo e rejeitado; pesquisa retorna trechos limitados e fontes.
- CA-009: rascunho clinico e persistido sem alterar `laudos.status`, `descricao`, `diagnostico` ou `observacoes`.
- CA-010: feedback, tokens e latencia aparecem nas metricas administrativas.
- CA-011: migration e idempotente; testes focais, suite, lint, TypeScript e build passam.
- CA-012: avaliacao versionada confirma ferramentas estritas e ausencia de SQL/escrita generica/finalizacao automatica.
- CA-013: radar persiste indicadores e alertas sem alterar registros de negocio ou criar acao pendente.
- CA-014: missao valida calcula proxima execucao; tipo arbitrario e configuracao de debitos sem clinica sao rejeitados.
- CA-015: scheduler usa lock distribuido, `skip_locked` no PostgreSQL e processa somente execucoes persistidas de tipos permitidos.
- CA-016: busca semantica encontra significado alem da correspondencia literal e mantem a fonte; indisponibilidade do provedor conserva o fallback lexical.
- CA-017: indexacao explicita cria trechos vetorizados locais e nunca inclui automaticamente pacientes, tutores, laudos ou conversas.
- CA-018: laboratorio registra nota e falhas por caso sem invocar `execute_tool`.
- CA-019: todas as novas rotas continuam protegidas por `require_papel("admin")`.
- CA-020: migration `20260721_54` e idempotente; testes focais, suite, lint, TypeScript e build passam.
- CA-021: workflows de stage e producao falham fechados quando o segredo OpenAI do ambiente estiver ausente e escrevem apenas `OPENAI_API_KEY` no arquivo privado do backend correspondente.
- CA-022: o dataset versionado cobre separadamente contexto clinico, rascunho completo e remarcacao com motivo explicito, mantendo `store=false` e zero chamadas a `execute_tool`.
- CA-023: o contrato do laboratorio cobre bloqueio direto, usa `max_output_tokens=800` e transforma ausencia de `function_call` em diagnostico persistido por caso.
- CA-024: feedback negativo com correcao cria aprendizado pendente e o contexto aprovado permanece inalterado antes da decisao.
- CA-025: aprovar nova sugestao cria memoria v1 e contrato ativo; aprovar ajuste cria a versao seguinte e arquiva o contrato anterior.
- CA-026: rejeitar sugestao nao altera a memoria; restaurar v1 depois de v2 cria v3 com o conteudo de v1.
- CA-027: o laboratorio marca contrato coerente como aprovado e divergencia de versao/hash como falha, sem chamar `execute_tool`.
- CA-028: todas as rotas de aprendizados, versoes, restauracao e regressoes possuem `require_papel("admin")`.
- CA-029: migration `20260722_55` e idempotente em SQLite e compativel com PostgreSQL.
- CA-030: testes focais, suite completa, lint, TypeScript, build e smokes de stage/producao passam antes da promocao.
- CA-031: as tres rotas Clinicas 360 possuem `require_papel("admin")` e rejeitam acesso anonimo ou nao administrador.
- CA-032: perfil focal confirma periodo atual/anterior, faturamento, agenda, servicos, debitos, preferencias, alertas e proveniencia.
- CA-033: payload completo do mapa nao contem identificador, nome, contato ou texto de paciente/tutor oriundo das fontes operacionais.
- CA-034: comparacao usa o mesmo contrato do perfil, aceita no minimo duas clinicas e identifica lideres de receita, agenda e prioridade por regra deterministica.
- CA-035: dataset versionado cobre consulta e comparacao 360 e as duas ferramentas continuam `strict` e somente leitura.
- CA-036: interface permite busca, periodo, perfil, selecao comparativa, aprofundamento na conversa e inspecao das fontes.
- CA-037: perfil com queda, cancelamentos e debito produz tres planos ligados exatamente aos alertas presentes, priorizando debito critico.
- CA-038: cada plano declara `automatic_execution=false`; todos os passos declaram `external_send=false` e `automatic_business_write=false`.
- CA-039: tipo `clinic_360` rejeita clinica ausente, limita periodo e descarta qualquer configuracao ou prompt livre nao permitido.
- CA-040: interface exige `Revisar missao` e depois `Aprovar e criar missao`; antes da segunda acao nenhuma missao e persistida.
- CA-041: botoes de contato e revisao apenas preenchem a conversa; envio externo e escrita operacional continuam ausentes ou sujeitos a acao pendente.
- CA-042: portfolio nao inclui os itens completos do plano, dataset cobre pedido de plano de acao e suite, lint, TypeScript e build passam.
- CA-043: `Animla Care` e `Vet Wrold` resolvem respectivamente `Animal Care` e `Vet World` quando nao existe concorrente proximo.
- CA-044: `Animal` com `Animal Care` e `Animal Clinic` permanece ambiguo e retorna as duas opcoes sem escolher silenciosamente.
- CA-045: rota de voz exige `admin`, rejeita tipo/extensao invalidos e bloqueia payload acima do limite.
- CA-046: transcricao usa `language=pt`, modelo configurado e prompt contendo termos veterinarios e nomes ativos de clinicas.
- CA-047: resposta declara revisao obrigatoria e ausencia de persistencia; auditoria nao recebe audio nem transcricao.
- CA-048: interface possui controles acessiveis para gravar/parar, limite automatico, estado de transcricao e preenchimento sem envio automatico.
- CA-049: comando transcrito usa o fluxo de chat existente e qualquer escrita continua `pending` ate aprovacao valida.
- CA-050: auditoria somente leitura identifica no historico real as lacunas de OS realizadas, deslocamento, funcionamento geral, vinculo de paciente e mensagens sem resposta.
- CA-051: teste soma OS `Pendente` e `Pago` de todas as clinicas e exclui `Cancelado`.
- CA-052: teste de deslocamento resolve `Vet Wrold`, chama a matriz oficial e preserva fonte e estimativa.
- CA-053: teste de funcionamento retorna a excecao efetiva sem clinica ou servico.
- CA-054: teste de vinculo confirma que nenhuma escrita ocorre antes da aprovacao e que o fluxo oficial recebe apenas paciente e tutor, preservando o horario.
- CA-055: teste de nova tentativa confirma duas mensagens finais, e nao tres, quando ja existe comando identico sem resposta.
- CA-056: dataset possui 23 casos, incluindo as cinco falhas reais e o erro `Uninassal`, com ferramentas estritas e laboratorio sem execucao.
- CA-057: em viewport vertical de 360 CSS pixels, `scrollWidth` nao supera `clientWidth` e o aviso administrativo, titulo, subtitulo, sete exemplos, mensagens e compositor quebram texto dentro da coluna; em desktop, historico e conversa continuam lado a lado.

## 7) Fora de escopo

- acesso de recepcao, veterinario, tutor ou clinica parceira;
- execucao autonoma sem solicitacao/confirmacao do admin;
- pesquisa aberta na internet;
- envio automatico de WhatsApp;
- assinatura, publicacao ou finalizacao automatica de laudo.
- missao com prompt livre, SQL, endpoint generico ou escrita autonoma;
- ingestao automatica de dados clinicos, conversas, pacientes ou tutores na memoria semantica;
- notificacao externa automatica a partir de alerta ou missao.
- aprendizado automatico sem revisao do administrador;
- apagamento ou sobrescrita silenciosa do historico de memoria.
- score preditivo opaco, recomendacao automatica a cliente ou alteracao operacional a partir do mapa Clinicas 360.
- criacao silenciosa de missao, contato externo automatico ou aplicacao direta de ajuste sugerido pelo plano.
- gravacao continua em segundo plano, envio automatico de transcricao ou aprovacao operacional por voz.
