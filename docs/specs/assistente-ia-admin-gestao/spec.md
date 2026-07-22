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

## 4) Persistencia

- existentes: `assistente_ia_conversas`, `assistente_ia_mensagens`, `assistente_ia_acoes_pendentes`;
- novos: `assistente_ia_memorias`, `assistente_ia_conhecimento_documentos`, `assistente_ia_feedbacks`, `assistente_ia_rascunhos_clinicos`, `agenda_bloqueios`;
- migration: `20260721_53_assistente_ia_copiloto.py`.

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
