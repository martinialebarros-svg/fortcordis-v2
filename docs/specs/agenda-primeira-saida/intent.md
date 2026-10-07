# Intent — Primeira saída da Agenda

Data: 2026-10-07
Responsável: Martiniano + Codex
Status: em execução

## Problema

Às 08:24, o assistente da Agenda ofereceu um primeiro atendimento às 08:30.
O cálculo existente considerava somente a antecedência geral da oferta e os
deslocamentos entre agendamentos. Sem um agendamento anterior, ignorava a viagem
desde a residência do profissional. Uma oferta pode também envelhecer no modal
antes de ser aceita e salva.

## Objetivo

Considerar a saída da residência para o primeiro atendimento de cada dia,
incluindo a hora atual quando a data é hoje. Respeitar a abertura da agenda, a
margem operacional de deslocamento e os horários mínimos pedidos para Caucaia,
Maracanaú, Eusébio e Itaitinga. O mesmo limite deve valer para sugerir e salvar,
mesmo quando o tempo passa entre as duas ações.

## Não objetivos

- Não reorganizar automaticamente atendimentos existentes nem calcular um roteiro
  completo de várias paradas.
- Não presumir que o endereço residencial seja uma clínica, nem expô-lo em
  respostas públicas, mensagens, logs operacionais ou dados de pacientes.
- Não alterar a duração do serviço, bloqueios, reservas, preferências do cliente
  ou regras de deslocamento entre dois atendimentos.
- Não publicar em stage ou produção como consequência desta implementação local.

## Contexto e restrições

- A residência foi informada pelo usuário como ponto de partida operacional; sua
  posição precisa ser configurada e validada para o cálculo da viagem.
- Fortaleza e municípios sem piso específico usam abertura da agenda e viagem
  desde casa. Caucaia usa piso de 08:30; Maracanaú, Eusébio e Itaitinga, 09:00.
- Para hoje, a saída viável nunca antecede o instante atual em Fortaleza.
- Sem localização ou tempo de viagem confiáveis, não se deve afirmar que o
  primeiro horário é alcançável.
- Dados reais de pacientes e agenda não são necessários aos testes. A alteração
  deve preservar horários já marcados e falhar de forma controlada.

## Riscos

- Relógio com segundos, arredondamento da grade, respostas tardias e diferenças
  entre consulta e salvamento podem reintroduzir ofertas impossíveis.
- Nomes de municípios podem variar em caixa, acentuação e espaços.
- Uma regra nova para a primeira saída pode interferir nos encaixes entre
  atendimentos se aplicada sem distinguir o primeiro destino do dia.

## Pronto para implementação

- [x] Problema, resultado esperado e cidades com piso definidos pelo usuário.
- [x] Usuário confirmou deslocamento desde casa para Fortaleza e demais cidades.
- [x] Escopo, riscos e validação em dados sintéticos definidos.
