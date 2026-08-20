# Intent - agenda-formalizacao-portal-clinicas

## Problema

`docs/specs/agenda-reserva-formalizacao-dados-pendentes/intent.md`
deixou o "item 1" (avisar a clínica que o agendamento foi formalizado)
explicitamente fora de escopo, porque dependia de um modelo novo
aprovado pela Meta. O modelo (`agendamento_formalizado`) foi submetido
e está em análise, mas ainda falta o mecanismo que faz a clínica
preencher os dados do paciente/tutor de forma que o sistema já capture
essa informação estruturada — hoje a clínica só responde por texto
livre no WhatsApp, e alguém da equipe precisa ler, interpretar e digitar
manualmente no cadastro.

Pedido do usuário: "quero um recurso que a clínica, ao receber a
mensagem de reserva, possa preencher os campos das informações do
paciente e essas informações sejam preenchidas automaticamente no
sistema. Uma vez concluído o preenchimento, confirme o sucesso do
recebimento das informações e a clínica receba essa mensagem de
formalização do agendamento."

## Alternativas avaliadas

- **WhatsApp Flow nativo** (formulário dentro do próprio chat): melhor
  experiência para a clínica, mas a conta Meta não atende aos dois
  pré-requisitos de publicação — melhoria da qualidade das mensagens e
  conclusão da verificação da empresa (documentos legais). Um rascunho
  de Flow foi salvo para uso futuro quando esses requisitos forem
  cumpridos, mas não pode ser publicado agora.
- **Link para formulário web com token opaco** (escolhida): reaproveita
  o padrão já validado em `PortalClinicInvite`/`portal_clinic_auth_service.py`
  (token bruto `secrets.token_urlsafe` + hash SHA-256 armazenado,
  nunca o valor bruto). Não depende de nenhuma aprovação da Meta, pode
  ser entregue via texto livre na janela de atendimento ao cliente
  (24h) que já se abre quando a clínica toca em qualquer botão de
  resposta rápida.

## Decisão de entrega do link

O modelo `dados_pendentes_agendamento` (`appointmentMissingData`) já
tem dois botões aprovados sem nenhum handler: "Enviar dados"
(`enviar_dados`) e "Falar com a equipe" (`falar_equipe`). Em vez de
depender de um humano copiar/colar o link manualmente, o clique em
"Enviar dados" agora gera o convite e envia o link como texto livre
automaticamente (o clique é uma mensagem inbound, então a janela de
atendimento está garantidamente aberta nesse momento). "Falar com a
equipe" cria um alerta interno, no mesmo padrão já usado para
"Solicitar alteração".

## Fora de escopo

- Publicar o WhatsApp Flow (bloqueado por pré-requisitos da Meta, fora
  do controle do time).
- Autenticação/conta para a clínica no link — é de uso único, com
  token opaco, sem sessão (diferente do Portal Clínicas autenticado em
  `/clinicas/portal/*`, que é uma ferramenta interna da equipe).
