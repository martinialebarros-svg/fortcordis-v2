# Intent - atendimento-cta-novo-duplicado

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #22 ("[UX] CTA 'Novo atendimento' duplicado"), origem
achado #3 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): quando um registro historico esta selecionado (`selecionado`
truthy), o header renderiza o botao "Novo atendimento deste paciente"
e, imediatamente abaixo, o banner ambar de "Registro historico
#{selecionado}" renderiza OUTRO botao com o mesmo texto - ambos
chamando exatamente `iniciarNovoAtendimentoPaciente()`. Como um
atendimento persistido selecionado normalmente implica
`form.paciente_id` preenchido, os dois botoes coexistem na pratica,
nao so em um caso de borda raro.

Confirmado ao vivo neste pacote: abrindo um atendimento persistido
real (`/atendimento?atendimento_id=1`), os dois botoes apareciam
simultaneamente - um no header, outro no banner ambar - poluindo a
tela do topo com 2 CTAs idênticos a poucos centímetros de distância.

## 2) Objetivo

Exatamente como sugerido pela auditoria: remover o botao do header
quando o banner ambar de "Registro historico" ja esta visivel,
mantendo a acao em um unico lugar - o banner, que ja explica o motivo
("Voce esta editando um atendimento ja existente...").

## 3) Nao objetivos

- Nao remove nem altera o botao do banner ambar (`selecionado`
  truthy) - permanece a unica via de acao nesse estado.
- Nao altera o comportamento do botao do header nos outros 2 estados
  (`selecionado` falso): continua mostrando "Novo atendimento" quando
  nao ha paciente selecionado (chamando `novoAtendimento()`), e "Novo
  atendimento deste paciente" quando ha paciente mas nenhum registro
  historico persistido selecionado ainda (rascunho local, chamando
  `iniciarNovoAtendimentoPaciente()`) - esses 2 casos nao tem
  duplicacao (o banner ambar so aparece com `selecionado` truthy) e
  continuam precisando do botao do header como unico ponto de acesso.
- Nao altera `iniciarNovoAtendimentoPaciente()` nem `novoAtendimento()`
  - so a condicao de renderizacao do botao do header.
