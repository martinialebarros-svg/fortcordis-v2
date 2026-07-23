# Spec - assistente-ia-admin-gestao

Data: 2026-07-22
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

## 3) Requisitos nao funcionais

- NFR-001 (seguranca): o modelo nao recebe SQL livre, shell, credenciais ou ferramenta generica de escrita.
- NFR-002 (privacidade): ferramentas retornam apenas os campos necessarios para cada tarefa; disponibilidade nao inclui paciente, tutor ou telefone.
- NFR-003 (confirmacao): nenhuma escrita operacional ocorre dentro do loop de ferramentas da IA; todas passam por acao pendente e decisao explicita do admin.
- NFR-004 (concorrencia): acao pendente usa snapshot e expiracao; mudanca do alvo invalida a aprovacao.
- NFR-005 (resiliencia): ausencia de chave, integracao desabilitada ou falha da OpenAI deve retornar erro operacional claro sem afetar os outros modulos.
- NFR-006 (custos): o loop de ferramentas deve ter limite configuravel e nao deve habilitar pesquisa web ou ferramentas hospedadas nesta versao.
- NFR-007 (estado): o backend guarda mensagens locais para a UI e usa `previous_response_id` para continuidade no provedor.
- NFR-008 (compatibilidade): a integracao usa o SDK oficial `openai`, sem exigir atualizacao ampla de FastAPI/Pydantic.
- NFR-009 (deploy): stage e producao devem usar segredos separados no GitHub Actions, sincronizados apenas com o `.env` do backend correspondente; o canario autenticado deve falhar se o assistente estiver desabilitado, sem credencial, sem modelo ou sem `admin_only`.
- NFR-010 (compatibilidade): Responses API, `previous_response_id`, SDK oficial e fluxos atuais permanecem a base da integracao.
- NFR-011 (autorizacao): ocultar a UI nao substitui o guard `admin` do backend.
- NFR-012 (clinico): rascunho sempre informa que requer revisao e que o laudo oficial nao foi modificado.
- NFR-013 (memoria): conteudo pendente ou rejeitado nunca entra no prompt.
- NFR-014 (conhecimento): ingestao e arquivamento sao explicitos e exclusivos do admin; busca e limitada a dez trechos.
- NFR-015 (observabilidade): tokens, latencia, status e identificador do provedor sao mensurados sem persistir segredos ou raciocinio interno.
- NFR-016 (autonomia segura): o scheduler nao possui ferramenta de escrita de negocio e nao transforma missao recorrente em prompt arbitrario.
- NFR-017 (rastreabilidade): todo alerta do radar inclui evidencia e recomendacao; toda recuperacao semantica preserva a fonte cadastrada.
- NFR-018 (isolamento de avaliacao): o laboratorio usa casos sinteticos, `store=false` e observa function calls sem enviar seus outputs para qualquer executor.
- NFR-019 (degradacao): falha de embeddings preserva a busca lexical; falha de uma execucao fica registrada sem afetar agenda, financeiro ou laudos.
- NFR-020 (segredos por ambiente): stage injeta somente `OPENAI_API_KEY_STAGE` e producao injeta somente `OPENAI_API_KEY_PROD` no `backend/.env` do ambiente correspondente, sem expor valores em logs ou frontend.
- NFR-021 (aprendizado supervisionado): nenhuma correcao, preferencia inferida ou feedback negativo muda automaticamente a memoria ativa.
- NFR-022 (reversibilidade): atualizacoes de memoria sao append-only no historico e a reversao nunca apaga versoes anteriores.
- NFR-023 (regressao segura): contratos de memoria usam somente identificador, versao e hash do conteudo aprovado; nao executam ferramentas nem carregam dados operacionais.
- NFR-024 (privacidade do portfolio): respostas de Clinicas 360 declaram e cumprem `contains_patient_or_tutor_data=false`.
- NFR-025 (proveniencia): nenhum indicador 360 e apresentado sem periodo, modo de leitura e fontes oficiais consultadas.
- NFR-026 (consistencia financeira): ordens pendentes e contas a receber permanecem separadas e o total combinado e rotulado como estimativa sem deduplicacao.
- NFR-027 (autonomia supervisionada): plano, missao, contato e revisao nao concedem ao scheduler nem ao modelo uma ferramenta generica de escrita.
- NFR-028 (explicabilidade): todo plano referencia um alerta e sua evidencia; nenhuma recomendacao usa score preditivo ou causa inferida de forma opaca.
- NFR-029 (minimizacao): os prompts sugeridos incluem apenas nome institucional, periodo e contexto gerencial do alerta, sem paciente ou tutor.

## 4) Persistencia

- existentes: `assistente_ia_conversas`, `assistente_ia_mensagens`, `assistente_ia_acoes_pendentes`;
- novos no copiloto: `assistente_ia_memorias`, `assistente_ia_conhecimento_documentos`, `assistente_ia_feedbacks`, `assistente_ia_rascunhos_clinicos`, `agenda_bloqueios`;
- novos na autonomia segura: `assistente_ia_conhecimento_trechos`, `assistente_ia_missoes`, `assistente_ia_execucoes` e colunas semanticas em `assistente_ia_conhecimento_documentos`;
- novos no aprendizado continuo: `assistente_ia_aprendizados`, `assistente_ia_memoria_versoes`, `assistente_ia_regressao_casos` e `assistente_ia_memorias.versao_atual`;
- migrations: `20260721_53_assistente_ia_copiloto.py`, `20260721_54_assistente_ia_autonomia.py` e `20260722_55_assistente_ia_aprendizado_supervisionado.py`.
- Clinicas 360 nao cria tabela ou migration: todos os indicadores sao calculados sob demanda sobre as fontes oficiais existentes.
- planos de acao tambem nao criam tabela ou migration; somente a missao aprovada reutiliza `assistente_ia_missoes` e `assistente_ia_execucoes`.

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

## 7) Criterios de regressao da versao base

- CR-001: nao-admin recebe 403 em chat, historico e decisao de acao.
- CR-002: consulta de 5 meses retorna serie mensal e variacao sem o modelo acessar o banco diretamente.
- CR-003: busca de agendamento por hoje, 10h e clinica retorna o candidato correto ou pede desambiguacao.
- CR-004: disponibilidade de ecocardiograma retorna slots das regras existentes, sem dados de paciente.
- CR-005: debitos pendentes por clinica retornam total, vencidos e itens.
- CR-006: pedir exclusao cria acao `pending`; o agendamento continua existindo.
- CR-007: rejeitar preserva o agendamento e encerra a acao.
- CR-008: aprovar um snapshot valido exclui via fluxo oficial e registra auditoria.
- CR-009: alvo alterado, expirado ou ja processado nao pode ser executado.
- CR-010: frontend permite iniciar conversa, ver historico e decidir acao pendente.
- CR-011: os deploys injetam `OPENAI_API_KEY_STAGE` ou `OPENAI_API_KEY_PROD` sem imprimir o valor e validam `/api/v1/assistente-ia/status` com autenticacao admin.
- CR-012: pedido de reserva cria apenas uma acao `pending`, mostra prazo e destinatario e nao altera `agendamentos` antes da aprovacao.
- CR-013: rejeicao de criacao preserva a agenda; aprovacao revalida o snapshot e chama o endpoint oficial uma unica vez.
- CR-014: conflito, mudanca de referencia, expiracao ou validacao operacional falha invalida a acao sem criar um horario parcial.
- CR-015: apos criacao, o frontend mostra a mensagem, permite copiar, escolher entre multiplos numeros e abrir o WhatsApp manualmente.
- CR-016: pedir para abrir a agenda amanha ate 18h gera acao pendente com comparacao antes/depois e nao altera configuracoes antes da decisao.
- CR-017: rejeitar preserva o funcionamento; aprovar cria ou substitui apenas a excecao da data informada.
- CR-018: mudanca concorrente nas excecoes invalida a acao e impede sobrescrita silenciosa.

## 8) Fora de escopo

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
