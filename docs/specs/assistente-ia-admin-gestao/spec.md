# Spec - assistente-ia-admin-gestao

Data: 2026-07-21
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

## 4) Persistencia

- existentes: `assistente_ia_conversas`, `assistente_ia_mensagens`, `assistente_ia_acoes_pendentes`;
- novos no copiloto: `assistente_ia_memorias`, `assistente_ia_conhecimento_documentos`, `assistente_ia_feedbacks`, `assistente_ia_rascunhos_clinicos`, `agenda_bloqueios`;
- novos na autonomia segura: `assistente_ia_conhecimento_trechos`, `assistente_ia_missoes`, `assistente_ia_execucoes` e colunas semanticas em `assistente_ia_conhecimento_documentos`;
- migrations: `20260721_53_assistente_ia_copiloto.py` e `20260721_54_assistente_ia_autonomia.py`.

## 5) Ferramentas

Leitura: `analisar_faturamento`, `localizar_agendamentos`, `verificar_disponibilidade`, `relatorio_debitos_pendentes`, `gerar_resumo_executivo`, `listar_bloqueios_agenda`, `consultar_conhecimento_interno`, `obter_contexto_laudo`.

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

## 7) Fora de escopo

- acesso de recepcao, veterinario, tutor ou clinica parceira;
- execucao autonoma sem solicitacao/confirmacao do admin;
- pesquisa aberta na internet;
- envio automatico de WhatsApp;
- assinatura, publicacao ou finalizacao automatica de laudo.
- missao com prompt livre, SQL, endpoint generico ou escrita autonoma;
- ingestao automatica de dados clinicos, conversas, pacientes ou tutores na memoria semantica;
- notificacao externa automatica a partir de alerta ou missao.
