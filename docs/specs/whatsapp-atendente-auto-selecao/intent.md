# Intent - whatsapp-atendente-auto-selecao

## Problema

Na Central de Atendimento WhatsApp (`/whatsapp-stage`), ao selecionar uma
conversa sem responsável, o campo "Atribuir para" caía sempre no primeiro
atendente da lista (`agents[0]`), independentemente de quem estivesse logado.
Quem estava atendendo precisava sempre trocar manualmente a seleção para o
próprio nome antes de assumir a conversa — um passo extra e uma fonte de erro
(esquecer de trocar atribui a conversa à pessoa errada).

## Objetivo

Pré-selecionar automaticamente o atendente cujo email corresponde ao usuário
autenticado no momento, para que "Assumir conversa" já aponte para a pessoa
certa sem passo manual extra.

## Escopo inicial

- hook `useCurrentUser` reutilizável em `frontend/lib/`, lendo o usuário
  autenticado salvo em `localStorage` pelo login;
- correspondência por email (normalizado: trim + lowercase) entre o usuário
  logado e a lista de atendentes (`agents`) do serviço WhatsApp;
- fallback ao comportamento anterior (primeiro atendente ativo da lista)
  quando não há correspondência.

## Fora de escopo

- vínculo formal/persistido entre usuário do sistema principal e atendente do
  serviço WhatsApp (continuam sendo cadastros desacoplados; a correspondência
  aqui é só por email, calculada no frontend a cada carregamento);
- criação automática de um registro em `agents` para um usuário logado sem
  atendente correspondente;
- pré-seleção quando a conversa já tem responsável (`last_agent_id`) — nesse
  caso o campo já reflete o atendente atual, sem mudança de comportamento.

## Riscos e decisões

- Atendentes inativos (`active: false`) são ignorados na correspondência,
  mesmo que o email bata — evita pré-selecionar alguém desativado. Descoberto
  que `GET /agents` retorna atendentes ativos e inativos sem filtro, então o
  filtro precisa acontecer no frontend.
- A correspondência é recalculada a cada carregamento da página (o hook lê o
  `localStorage` uma vez por montagem); não sincroniza entre abas abertas
  simultaneamente com usuários diferentes no mesmo navegador.
