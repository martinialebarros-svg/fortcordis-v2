# Spec - whatsapp-produtividade-equipe

## Referência

Contrato da melhoria sobre `origin/stage` em `1dd7680e`, implementada na worktree
isolada `/Users/martiniano/.codex/worktrees/whatsapp-produtividade`. A verificação
de cada requisito está separada em `verify.md`.

## Requisitos funcionais

### Fila e busca

- RF-001: a resposta de consulta de conversas deve disponibilizar resumo
  global com `total`, `unread`, `unassigned`, `open`, `pending` e `closed`.
  Quando informado `agent_id` de referência, deve disponibilizar também
  `mine`, correspondente às conversas desse atendente. Os totais não podem
  depender da página visível, do texto buscado ou dos demais filtros da lista.
- RF-002: `unread` deve usar o mesmo critério da lista: há mensagem recebida e
  `last_seen_at` é ausente ou anterior a `last_inbound_at`. `unassigned` deve
  contar conversas com `last_agent_id` ausente; os totais de status devem usar
  os valores persistidos `open`, `pending` e `closed`.
- RF-003: a lista deve aceitar `agent_id` para um responsável específico e
  `unread=true` para conversas não lidas, combinados com status e busca. A
  interface deve permitir selecionar as conversas do atendente logado quando
  houver correspondência de email com um atendente ativo, sem atribuir
  silenciosamente outro atendente ao filtro pessoal.
- RF-004: a busca deve localizar o mesmo telefone com ou sem espaços,
  parênteses e hífen. Deve manter a pesquisa por assunto/nome da conversa e
  última mensagem; não deve apresentar essa pesquisa como busca em todo o
  histórico textual.
- RF-005: a busca digitada deve ser aplicada após 300 ms sem nova edição. A
  atualização periódica da lista deve ocorrer a cada 15 segundos enquanto a
  página estiver visível. Busca, filtros e paginação devem invalidar respostas
  de consultas anteriores, que não podem alterar lista, paginação ou seleção.
- RF-006: indicadores globais devem ser distinguidos da quantidade de
  resultados filtrados. Filtrar, paginar, atualizar ou alterar a classificação
  da conversa não deve selecionar automaticamente outro contato só porque a
  conversa atual saiu dos resultados. O atendimento permanece aberto até uma
  seleção explícita de outra conversa.

### Histórico

- RF-007: `GET /whatsapp/conversations/:id/messages?order=latest&page=1&limit=50`
  deve selecionar as últimas 50 mensagens. A consulta deve ter desempate
  determinístico por ID; a página selecionada em ordem decrescente deve ser
  invertida para leitura cronológica na resposta. `order=latest` é explícito,
  preservando o comportamento anterior para consumidores que não o enviem.
- RF-008: a central deve abrir a conversa pelas mensagens mais recentes e
  permitir carregar páginas anteriores. As páginas devem se acumular em ordem
  cronológica, deduplicadas por ID. Atualizações de mensagens recentes não
  devem apagar o histórico anterior já carregado nem duplicar mensagens nas
  fronteiras de paginação.
- RF-009: uma resposta de histórico de outra conversa, ou de uma seleção
  anterior da mesma conversa que deixou de ser válida, não pode substituir o
  histórico atualmente exibido.

### Rascunhos e envio

- RF-010: texto e arquivo `File` do compositor devem ser guardados por ID de
  conversa durante a montagem da central. A troca A → B mostra apenas o
  rascunho de B; ao voltar a A, o texto exato e o mesmo arquivo devem reaparecer.
- RF-011: `useWhatsAppDrafts(conversationId)` deve expor `body`, `file`,
  `draftSnapshot`, `setBody(string)`, `setFile(File | null)`, `hasDraft(id)`,
  `clearDraft(id?)` e `clearDraftIfUnchanged(id, snapshot)`. Sem conversa
  selecionada, setters não devem criar rascunhos. Descarte explícito deve
  afetar somente o ID indicado, por padrão o selecionado.
- RF-012: o envio deve capturar destinatário, conteúdo e snapshot antes da
  requisição. O sucesso deve limpar o snapshot somente se ele ainda for o
  rascunho atual daquele ID, inclusive quando outro contato estiver aberto.
  Texto editado, arquivo substituído ou edição que voltou ao conteúdo anterior
  enquanto o POST estava pendente devem ser preservados.
- RF-013: clique repetido ou repetição de Ctrl/Cmd + Enter durante um envio
  pendente não pode iniciar o mesmo envio novamente. Erros de rede e respostas
  de falha devem produzir feedback, preservar o rascunho e liberar a trava em
  `finally`. Essa proteção local não deve ser descrita como garantia de
  idempotência após uma resposta de rede ambígua.
- RF-014: escolher resposta rápida deve acrescentá-la ao texto atual com
  separação legível, preservando o conteúdo já escrito e o arquivo associado.

### Responsável e copiloto

- RF-015: ao abrir uma conversa atribuída, o campo de transferência deve ser
  inicializado com o responsável atual. Ao escolher outro atendente, a escolha
  deve permanecer até sua confirmação ou mudança efetiva de contexto; efeitos
  de inicialização e polling não podem restaurar automaticamente o anterior.
  Conversas sem responsável mantêm a preferência pelo atendente logado ativo e
  o fallback existente de inicialização quando não há correspondência.
- RF-016: trocar de conversa deve remover imediatamente o estado e as ações
  da sugestão anterior enquanto o novo estado carrega. Respostas atrasadas de
  leitura, mudança de modo ou pausa devem ser aplicadas somente à conversa
  correspondente, impedindo que o rascunho de A seja exibido sob o contato B.
- RF-017: o polling do copiloto não deve substituir a edição local enquanto o
  mesmo rascunho permanece pendente. A edição deve estar vinculada à conversa
  e ao rascunho revisado, sem reutilizar texto editado de outro contexto.

## Requisitos não funcionais e limites

- RNF-001: rascunhos de mensagens e arquivos ficam exclusivamente na memória
  da instância montada da página; não usar storage persistente do navegador,
  banco ou serviço externo. Desmontar/recarregar a central encerra sua retenção.
- RNF-002: manter autorização das APIs, janela de texto livre de 24 horas,
  rotas e requisitos de modelos aprovados, validação dos anexos e reenvio do
  bot pela rota específica de resposta revisada. Não habilitar modo automático
  nem mudar callback ou credenciais.
- RNF-003: testes desta entrega devem usar mocks/dados simulados e não enviar
  mensagens reais. Não registrar conteúdo privado ou credenciais em logs de
  verificação.
- RNF-004: implementar os controles com rótulos acessíveis, estado de
  carregamento e feedback de falha. Preservar o atalho Ctrl/Cmd + Enter sujeito
  às mesmas validações do botão de envio.
- RNF-005: não afirmar ganho percentual ou redução de tempo de atendimento
  sem medição operacional. Aprovação de testes locais não constitui evidência
  de publicação ou de comportamento em produção.

## Critérios de aceitação

| Critério | Comportamento verificável |
|---|---|
| CA-001 | Mais de uma página e filtros ativos não reduzem indevidamente os totais globais; `mine` corresponde ao `agent_id` informado. |
| CA-002 | Filtros por atendente e não lidas combinam com status/busca; busca encontra telefone formatado. |
| CA-003 | Digitação rápida dispara busca após 300 ms; polling respeita 15 s e visibilidade; resultado atrasado é ignorado. |
| CA-004 | Conversa selecionada continua aberta ao sair dos filtros ou da página da lista. |
| CA-005 | Conversa com mais de 50 mensagens abre nas últimas 50; páginas anteriores acumulam sem duplicatas, inclusive após refresh recente. |
| CA-006 | Histórico atrasado de outra seleção não substitui a conversa atual. |
| CA-007 | Texto e arquivo ficam isolados por conversa e reaparecem ao retornar; desmontar apaga os rascunhos. |
| CA-008 | Sucesso de envio limpa apenas o snapshot enviado; alterações posteriores de texto/arquivo permanecem. |
| CA-009 | Submissão repetida não cria outro POST pendente; falha de rede preserva rascunho e libera nova tentativa. |
| CA-010 | Resposta rápida acrescenta conteúdo sem apagar texto ou arquivo. |
| CA-011 | Atendente escolhido para transferência permanece selecionado até confirmar; inicialização de conversa sem responsável continua válida. |
| CA-012 | Estado/sugestão anterior desaparece na troca; polling preserva edição do rascunho atual e respostas atrasadas não contaminam outra conversa. |
| CA-013 | Janela de 24 h, anexos, contexto de domínio e reenvio revisado do bot continuam passando nos testes relacionados. |

## Regressão automatizada na entrega

Os quality gates de stage e produção devem executar os contratos de
produtividade e ordenação em banco PostgreSQL exclusivo de teste, criado no
serviço efêmero do job. Essa configuração não dispara nem autoriza publicação.
Ao receber um lote recente sem sobreposição com o histórico já carregado, a
UI deve revisitar as páginas anteriores para preencher a lacuna. Refresh após
mutações deve usar a busca, os filtros e a página atuais.

## Continuação da produtividade

O contrato complementar em `../whatsapp-fila-respostas/spec.md` acrescenta
pendências independentes de leitura, biblioteca configurável e avanço por
ação explícita. “Resolver e abrir próxima” é a seleção explícita prevista
pelo RF-006; polling/filtros comuns continuam preservando a conversa aberta.
