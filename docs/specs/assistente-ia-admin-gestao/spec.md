# Spec - assistente-ia-admin-gestao

Data: 2026-07-20
Responsavel: Martiniano + Codex
Status: completed

## 1) Escopo funcional

Criar um modulo administrativo de IA no backend FastAPI e uma pagina no frontend Next.js. O modelo deve operar apenas por ferramentas deterministicas do FortCordis e nunca receber acesso direto ao banco ou a endpoints genericos de escrita.

## 2) Requisitos funcionais

- RF-001: todas as rotas em `/api/v1/assistente-ia` devem exigir papel `admin` no backend.
- RF-002: a navegacao e a pagina `/assistente-ia` devem ser exibidas apenas para admin; acesso direto de nao-admin deve ser bloqueado pela API e redirecionado pela pagina.
- RF-003: `POST /api/v1/assistente-ia/chat` deve criar ou continuar uma conversa e retornar a resposta final, ferramentas usadas e eventual acao pendente.
- RF-004: a IA deve consultar dinamica financeira mensal entre 2 e 24 meses, globalmente ou por clinica.
- RF-005: a IA deve localizar agendamentos por data, horario e clinica, retornando candidatos suficientes para desambiguacao.
- RF-006: a IA deve consultar disponibilidade por clinica, servico, data inicial e horizonte limitado, reutilizando a regra operacional existente da agenda.
- RF-007: a IA deve gerar um relatorio estruturado de debitos pendentes por clinica, com totais, atraso e itens.
- RF-008: a IA pode preparar uma solicitacao de exclusao somente para um `agendamento_id` existente e produzir uma acao pendente com snapshot do alvo.
- RF-009: `POST /api/v1/assistente-ia/acoes/{id}/decisao` deve aceitar aprovacao ou rejeicao explicita do mesmo administrador.
- RF-010: uma aprovacao deve revalidar papel, proprietario, validade, status e snapshot antes de executar a exclusao pela regra oficial da agenda.
- RF-011: conversas e mensagens devem permanecer persistidas e consultaveis pelo administrador proprietario.
- RF-012: cada ferramenta executada deve deixar metadados auditaveis sem registrar a chave da API nem raciocinio interno do modelo.

## 3) Requisitos nao funcionais

- NFR-001 (seguranca): o modelo nao recebe SQL livre, shell, credenciais ou ferramenta generica de escrita.
- NFR-002 (privacidade): ferramentas retornam apenas os campos necessarios para cada tarefa; disponibilidade nao inclui paciente, tutor ou telefone.
- NFR-003 (confirmacao): exclusao nunca ocorre dentro do loop de ferramentas da IA.
- NFR-004 (concorrencia): acao pendente usa snapshot e expiracao; mudanca do alvo invalida a aprovacao.
- NFR-005 (resiliencia): ausencia de chave, integracao desabilitada ou falha da OpenAI deve retornar erro operacional claro sem afetar os outros modulos.
- NFR-006 (custos): o loop de ferramentas deve ter limite configuravel e nao deve habilitar pesquisa web ou ferramentas hospedadas nesta versao.
- NFR-007 (estado): o backend guarda mensagens locais para a UI e usa `previous_response_id` para continuidade no provedor.
- NFR-008 (compatibilidade): a integracao usa o SDK oficial `openai`, sem exigir atualizacao ampla de FastAPI/Pydantic.
- NFR-009 (stage): o segredo deve ser sincronizado pelo workflow apenas para o `.env` do backend de stage e o canario autenticado deve falhar se o assistente estiver desabilitado, sem credencial, sem modelo ou sem `admin_only`.

## 4) Contratos tecnicos

### Configuracao

- `OPENAI_API_KEY`: chave da API, somente no servidor.
- `ASSISTENTE_IA_ENABLED`: habilita ou desabilita o modulo.
- `ASSISTENTE_IA_MODEL`: modelo ativo; padrao `gpt-5.6-sol`.
- `ASSISTENTE_IA_MAX_TOOL_LOOPS`: teto de loops por mensagem.
- `ASSISTENTE_IA_ACTION_TTL_MINUTES`: validade de uma aprovacao pendente.

### Ferramentas iniciais

1. `analisar_faturamento`
2. `localizar_agendamentos`
3. `verificar_disponibilidade`
4. `relatorio_debitos_pendentes`
5. `solicitar_exclusao_agendamento`

### Persistencia

- `assistente_ia_conversas` para titulo, proprietario e `previous_response_id`;
- `assistente_ia_mensagens` para historico visivel e metadados de ferramentas;
- `assistente_ia_acoes_pendentes` para argumentos, snapshot, decisao e execucao.

## 5) Criterios de aceitacao

- CA-001: nao-admin recebe 403 em chat, historico e decisao de acao.
- CA-002: consulta de 5 meses retorna serie mensal e variacao sem o modelo acessar o banco diretamente.
- CA-003: busca de agendamento por hoje, 10h e clinica retorna o candidato correto ou pede desambiguacao.
- CA-004: disponibilidade de ecocardiograma retorna slots das regras existentes, sem dados de paciente.
- CA-005: debitos pendentes por clinica retornam total, vencidos e itens.
- CA-006: pedir exclusao cria acao `pending`; o agendamento continua existindo.
- CA-007: rejeitar preserva o agendamento e encerra a acao.
- CA-008: aprovar um snapshot valido exclui via fluxo oficial e registra auditoria.
- CA-009: alvo alterado, expirado ou ja processado nao pode ser executado.
- CA-010: frontend permite iniciar conversa, ver historico e decidir acao pendente.
- CA-011: deploy de stage injeta `OPENAI_API_KEY_STAGE` sem imprimir o valor e valida `/api/v1/assistente-ia/status` com autenticacao admin.

## 6) Fora de escopo

- agentes especialistas ou multiagente;
- busca na internet;
- memoria semantica ou vector store;
- elaboracao de laudos;
- automacoes autonomas sem solicitacao do admin.
