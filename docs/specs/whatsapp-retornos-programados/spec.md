# Spec — retornos programados do WhatsApp

## Comportamento

- Um retorno por conversa com estado pending/completed/cancelled. Agendar após
  conclusão/cancelamento reutiliza a linha com nova revisão; não recria versão 0.
- Agendamento exige responsável ativo, nota não vazia até 1000 caracteres e
  data futura até 366 dias. Datas HTTP têm fuso explícito; tela usa Fortaleza.
- Atalhos: em 30 minutos, amanhã às 9h, ou data/hora escolhida.
- Responsável pelo retorno é independente do dono da conversa: agendar não
  assume/transfere atendimento. Apenas agentes ativos podem receber agendamento.
- Reagendar permite alterar prazo, nota e responsável. Concluir/cancelar altera
  apenas retorno. Ler mensagens, responder ou resolver conversa não encerra
  silenciosamente o compromisso; conclusão do retorno é explícita.
- Uma mensagem inbound recém-persistida destaca “Cliente respondeu · revisar
  retorno”, preserva a nota e antecipa a atenção mesmo antes do prazo. Payload
  duplicado e mensagem duplicada não alteram o retorno; outbound/status também não.
- Filtros: todos pendentes; precisam de atenção (vencidos ou cliente respondeu);
  atrasados (due_at <= now); hoje a vencer; a partir de amanhã; cliente respondeu.
  Limite diário calculado em America/Fortaleza, independente do fuso do navegador.
- “Meus retornos” usa o agente ativo cujo e-mail coincide com o usuário atual;
  não confunde IDs de usuário e agente ou proprietário da conversa.
- Filtros combinam busca, status, responsável da conversa, não lidas e precisa de
  resposta. Limpar filtros remove também filtros de retorno. Ações dos contadores
  removem filtros conflitantes e levam à fila completa/pessoal correspondente.
- Ordenação de retornos por primeiro recebimento após agendamento, quando houver,
  ou vencimento, com desempate por ID. Sem filtro, ordem histórica fica intacta.
- Contadores globais independem dos filtros e paginação. Atualização no módulo
  visível a cada 15s e ao retornar à aba; não é push com aplicativo fechado.

## Contratos e dados

`GET /conversations/:id/follow-up` retorna `{data: objeto|null}`; 404 se não existe
conversa, 422 para ID inválido. Objeto contém due_at, note, agent_id (string),
agent_name, status, revision (inteiro), inbound_received_at e updated_at.

`PATCH /conversations/:id/follow-up` recebe action=schedule|complete|cancel e
expected_revision inteiro >=0. Schedule recebe due_at ISO com fuso, note,
agent_id string. Revisão 0 significa que ainda não existe retorno. Resposta 200
com data; 422 entrada inválida/agente inativo; 404 conversa ausente; 409
FOLLOW_UP_CHANGED para revisão divergente ou término sem retorno pendente.

As duas rotas usam requireApiAuth e ACL de leitura/escrita existente. Gravação
obtém FOR UPDATE na conversa, igual ao inbound; responsável é validado sob
FOR SHARE. Audita ação, revisão, ID do usuário autenticado e origem da autenticação,
sem duplicar nota em logs de auditoria. Não há envio Meta nem mudança de callback.

`GET /conversations` inclui follow_up (inclusive último estado terminal) e aceita
follow_up=all|ready|due|today|upcoming|responded, follow_up_agent_id e
summary_agent_id. Este último informa apenas a contagem pessoal, sem filtrar
conversas. Summary inclui follow_up_due, follow_up_ready e my_follow_up_ready.

## Recuperação e limites

- Notas ainda não salvas ficam só na memória, separadas por conversa e usuário;
  não são persistidas em localStorage. Recarregar/sair descarta rascunhos.
- Leituras têm timeout/cancelamento e não apagam nota digitada. Gravação em uma
  conversa não altera a edição em outra. Resposta de leitura anterior à gravação
  não pode substituir os dados salvos.
- Conflito preserva rascunho; atualizar mostra versão atual. Para reagendar usando
  rascunho antigo é necessário revisar e clicar “Usar versão atual e manter nota”.
- Duplo clique não dispara gravações paralelas. Timeout não confirma gravação:
  atualizar antes de repetir; a revisão protege contra duplicação/sobrescrita.
- Concluir um retorno não envia resposta nem fecha conversa. “Resolver e abrir
  próxima” preserva também os filtros de retorno na seleção da próxima pendência.
- Uma nota atual por conversa; não há histórico navegável de notas anteriores,
  recorrência, múltiplos retornos simultâneos ou notificações fora deste módulo.

O controller importa explicitamente a declaração Express de autenticação para
que os contratos ts-node carreguem os mesmos tipos do build completo.
