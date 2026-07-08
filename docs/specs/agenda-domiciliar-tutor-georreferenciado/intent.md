# Intent - agenda-domiciliar-tutor-georreferenciado

Data: 2026-07-08
Responsavel: Martiniano + Codex
Status: approved

## Problema

Quando o atendimento era solicitado diretamente pelo tutor, a operacao vinha contornando a agenda com uma clinica temporaria `DOMICILIAR`. Isso embaralhava endereco, sugestao de horarios, roteamento e financeiro, alem de esconder a relacao real entre tutor, pets e atendimento.

## Objetivo

Criar um fluxo domiciliar explicito na agenda, usando o tutor como referencia operacional. O sistema deve permitir georreferenciar o endereco do tutor, salvar agendamentos domiciliares sem clinica ficticia, manter compatibilidade com registros legados e refletir essa origem tambem em OS e financeiro.

## Resultado esperado

- O tutor passa a concentrar endereco georreferenciado e visao panoramica dos pets.
- A agenda salva e exibe atendimentos domiciliares sem precisar de clinica placeholder.
- OS e financeiro tratam o domiciliar com preco e destinatario corretos.
