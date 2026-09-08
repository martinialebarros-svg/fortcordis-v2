# Spec — fila de respostas WhatsApp

## Pendência e espera

- RF-001: `GET /whatsapp/conversations` aceita `needs_reply=true|false`, com
  validação estrita e combinação com busca, status, responsável e não lidas.
  Cada item traz `needs_reply`, `waiting_since` e `last_message_id`.
  `summary.needs_reply` conta a base inteira, independente dos filtros/página.
- RF-002: existe pendência quando há mensagem recebida posterior à última
  mensagem enviada com status `sent`, `delivered` ou `read` e não coberta pelo
  marco de resolução explícita. A ordem para resposta é `(created_at,id)`,
  inclusive reenvio que reaproveita ID. `failed` e `pending` não respondem;
  marcar como lida não muda a pendência. `waiting_since` é a primeira mensagem
  ainda pendente, em tempo corrido, sem descontar horário de expediente.
- RF-003: `needs_reply=true` ordena pela espera mais antiga com desempate
  determinístico. Sem esse filtro mantém a ordenação anterior. O card global
  abre todas as pendências; o checkbox permite combinar com filtros atuais.
- RF-004: resolver registra `resolved_through_message_id` com maior ID
  persistido, usando 0 para conversa vazia. Migração marca fechadas legadas
  uma única vez. Nova mensagem inbound reabre `pending`/`closed`; duplicação
  de webhook ou de mensagem não reabre. Mensagens anteriores ao fechamento
  não voltam à fila junto com um contato novo.

## Ações do atendimento

- RF-005: `GET /messages` informa `last_message_id` (maior ID persistido).
  Fechamento pela UI usa o token do histórico carregado em
  `expected_last_message_id`, string ou null. Sob lock da conversa, divergência
  retorna `409 CONVERSATION_CHANGED` sem resolver. A UI recarrega o histórico
  e orienta revisar. O parâmetro é opcional para compatibilidade das APIs
  existentes; os controles novos e o seletor de status da central o enviam.
- RF-006: “Resolver e abrir próxima” conclui, consulta novamente a pendência
  mais antiga com os filtros ativos e a seleciona. Não depende da página
  anteriormente carregada; nenhuma outra pendência produz feedback explícito.
  Falha no fechamento não avança. Falha da consulta seguinte informa que o
  fechamento foi concluído e permite atualizar a fila.
- RF-007: uma mudança de seleção ou de filtros durante a operação impede o
  avanço atrasado. Repetir clique enquanto a ação está em curso produz apenas
  uma mutação. Rascunhos e anexos continuam isolados e preservados por conversa.
- RF-008: “Assumir para mim” aparece para conversa sem responsável e usa
  somente o atendente ativo vinculado ao email do usuário; sem vínculo fica
  indisponível. `only_if_unassigned=true` no claim verifica o responsável sob
  lock; outro dono retorna `409 CONVERSATION_ALREADY_ASSIGNED` e é preservado.
  A transferência explícita existente continua disponível.

## Respostas rápidas

- RF-009: biblioteca compartilhada via `GET/POST /whatsapp/quick-replies` e
  `PATCH /whatsapp/quick-replies/:id`. Respostas têm id, título (1–100), corpo
  (1–4096), categoria (até 60), atalho (2–32 letras ASCII minúsculas, números,
  hífen ou sublinhado, sem barra), ativo e timestamps. Retorno `{data:...}`.
  GET inclui inativas para gerenciamento, mas inserção só oferece ativas.
- RF-010: mesma autenticação e ACL de leitura/escrita da central. Atalho é
  único inclusive em registros inativos. Conflito retorna 409. Desativação
  preserva o registro e permite reativar. Não há exclusão definitiva.
- RF-011: PATCH exige `expected_updated_at` e atualiza versão atomicamente,
  com precisão de milissegundos. Conflito `QUICK_REPLY_STALE` preserva a edição
  local e oferece carregar a versão atual da equipe.
- RF-012: migração cria as três frases anteriores com chave estável de seed;
  execução repetida não duplica, renomeia nem reativa alterações da equipe.
- RF-013: UI busca título, corpo, categoria e atalho, ignorando acentos na
  busca textual, e filtra categoria. Digitar `/atalho` no final do compositor
  filtra sugestões; clicar substitui somente esse sufixo. Sem atalho, inserção
  acrescenta texto ao rascunho. Texto anterior e anexo são preservados.
- RF-014: inserir frase nunca envia mensagem. Biblioteca fica fora do form de
  envio, e os botões são `type=button`. Busca/gestão não disparam envio ao
  pressionar Enter. Janela de atendimento continua limitando inserção/envio.
- RF-015: leitura tem timeout/cancelamento, falha oferece atualização e não
  apaga lista carregada; edição tem trava de envio e retorno de falha. Cadastro
  compartilhado é atualizado na abertura ou pelo botão Atualizar biblioteca.

- RF-016: favoritos pessoais permitem destacar frases e filtrar somente as
  favoritas. São persistidos no navegador como IDs, separados pelo ID do
  usuário; nenhum conteúdo de mensagem ou rascunho é armazenado nesse recurso.
  Trocar de usuário não reutiliza seus favoritos.

## Limites e segurança

Dados e APIs externos são simulados nos testes. Não mudar callback, segredos,
modelos aprovados, critérios clínicos ou modo automático do bot. Frases são
texto operacional redigido pela equipe, sem geração de conteúdo clínico novo.
Esta fila mede ausência de resposta enviada, não a qualidade ou resolução do
assunto. Fechamento explícito é uma decisão humana e não envia mensagem.

Rollback compatível descrito em plan.md. Evidências e resultados em verify.md.

## Continuação — retornos programados

A etapa `whatsapp-retornos-programados` acrescenta compromissos internos com
prazo, nota e responsável. Conclusão de retorno é independente de resolução da
conversa; filtros novos também são respeitados por “Resolver e abrir próxima”.
Ver `../whatsapp-retornos-programados/spec.md` e `verify.md`.
