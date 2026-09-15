# Intent - whatsapp-central-atendimento-ui

## Problema

A tela `WhatsApp Stage` expõe os recursos técnicos da integração, mas exige que
o operador interprete estados em inglês, telefone cru, `claim/unclaim`, IDs da
Meta e formulários de administração dentro da rotina de atendimento. O
compositor também é limitado a uma linha e o catálogo de modelos configurados
não está visível na central.

## Objetivo

Transformar a tela em uma Central de Atendimento WhatsApp orientada ao trabalho
diário, com fila pesquisável, conversa legível, contexto do contato,
distribuição de responsabilidade e consulta/preview seguro dos modelos
configurados.

## Escopo inicial

- reorganizar a interface em fila, conversa e contexto;
- traduzir estados técnicos e ocultar IDs em detalhes expansíveis;
- permitir busca por telefone, nome/assunto e última mensagem;
- mostrar o atendente atribuído e permitir assumir, transferir ou liberar;
- permitir classificar a conversa como aberta, aguardando ou resolvida;
- melhorar o compositor de texto livre e oferecer respostas rápidas;
- expor catálogo e preview dos modelos configurados sem afirmar aprovação em
  tempo real na Meta;
- resolver automaticamente o contexto cadastral pelo número do WhatsApp e
  reunir clínica, tutor, pet, agendamentos e OS relacionados;
- preservar a regra da janela de atendimento de 24 horas.

## Fora de escopo

- anexos e mídia no compositor da caixa de entrada;
- notas internas, etiquetas persistentes e contagem de não lidas;
- gravação de vínculo manual ou alteração automática dos cadastros de domínio;
- envio manual de modelos que executam ações de domínio sem um vínculo seguro
  com o respectivo agendamento, exame ou OS;
- consulta em tempo real do status de aprovação do modelo na Meta.

## Riscos e decisões

- Um botão de modelo pode confirmar agendamento ou tratar cobrança. Por isso a
  primeira entrega mostra e permite preencher/visualizar o modelo, mas não cria
  um atalho genérico que perderia o vínculo com o objeto de domínio.
- A pesquisa em mensagens usa apenas a última mensagem da conversa para manter
  a consulta simples nesta fase.
- O assunto recebido do perfil do WhatsApp é usado como nome amigável quando
  disponível; não é tratado como vínculo cadastral com uma clínica.
- O vínculo cadastral usa exclusivamente o telefone normalizado. Quando o
  mesmo número pertence a mais de uma clínica/tutor, a central informa a
  ambiguidade e não escolhe um cadastro automaticamente.
- Como as conversas e o domínio Fort Cordis usam serviços/bancos distintos, o
  contexto é resolvido pelo backend principal e consumido pela UI; nenhuma
  cópia de clínica, tutor, pet, agendamento ou OS é persistida no banco do
  serviço WhatsApp.
