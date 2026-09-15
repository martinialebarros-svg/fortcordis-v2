# Intent - whatsapp-equipe-atendentes-edicao

## Problema

A seção "Configurar equipe" da Central de Atendimento WhatsApp
(`/whatsapp-stage`) só permitia cadastrar novos atendentes. Corrigir um nome
ou email digitado errado, trocar o perfil (atendente/supervisor) ou desativar
alguém que saiu da equipe exigia alteração direta na tabela `agents` do banco
do serviço WhatsApp, sem nenhuma tela de apoio.

## Objetivo

Permitir editar os dados de um atendente já cadastrado e ativar/desativar seu
acesso diretamente pela mesma seção "Configurar equipe", sem exigir acesso ao
banco de dados.

## Escopo inicial

- endpoint `PATCH /agents/:id` no backend do serviço WhatsApp, aceitando
  atualização parcial de `name`, `email`, `role` e/ou `active`;
- formulário de edição inline por atendente na lista de "Equipe", com
  Salvar/Cancelar;
- ação rápida de "Desativar"/"Reativar" sem precisar abrir o formulário
  completo.

## Fora de escopo

- exclusão definitiva (hard delete) de atendentes;
- histórico/auditoria de quem editou ou desativou um atendente;
- reatribuição em massa das conversas já vinculadas a um atendente desativado;
- alteração de senha ou credenciais de acesso (o atendente do serviço WhatsApp
  não possui login próprio, é apenas um registro de identificação usado em
  `claim`/`unclaim`).

## Riscos e decisões

- Desativar um atendente não reatribui automaticamente as conversas que já
  estavam com `last_agent_id` apontando para ele; a conversa continua
  mostrando o histórico, mas o atendente inativo não aparece mais nas opções
  de atribuição (`agents.filter(active)`).
- Optou-se por `PATCH` parcial em vez de reenviar o registro inteiro, para
  permitir o toggle rápido de `active` com uma única chamada, sem depender do
  estado do formulário de edição completo.
- Mantido o mesmo padrão de autenticação do `POST /agents` existente
  (`requireApiAuth`, papéis de escrita), sem introduzir uma política nova.
