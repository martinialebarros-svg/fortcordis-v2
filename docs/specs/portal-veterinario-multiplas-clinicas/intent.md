# Intent - portal-veterinario-multiplas-clinicas

Data: 2026-09-16  
Responsavel: Martiniano  
Status: in-progress

## 1) Problema atual

O veterinario parceiro nao tem vinculo nenhum com clinica. O campo
`portal_partner_profiles.clinica_id` existe, mas e `unique` e serve ao parceiro
do tipo `clinica`; para o tipo `veterinario` a API recusa o campo de proposito
(`"clinica_id nao se aplica ao tipo veterinario."`). O seletor
`Veterinario parceiro | Clinica vinculada` da tela de cadastro escolhe o **tipo**
do parceiro, nao um vinculo — quem olha a tela le como se fosse vinculo.

Na pratica, parte dos veterinarios parceiros atende em 3 ou mais clinicas. Hoje
cada laudo precisa nomear o veterinario a mao, um a um, mesmo quando a clinica
de origem sempre encaminha para o mesmo profissional. Esquecer de nomear o
veterinario significa que ele nao recebe o aviso por WhatsApp nem o email de
laudo liberado, e nao enxerga o caso no portal.

## 2) Objetivo

Permitir vincular um veterinario parceiro a **varias** clinicas e, por vinculo,
decidir se ele recebe automaticamente os laudos daquela clinica.

O vinculo carrega um interruptor `receber_todos_laudos`:

- **Ligado** — todo laudo daquela clinica libera no portal e avisa esse
  veterinario (WhatsApp + email), sem precisar nomea-lo no laudo. Serve a
  clinica pequena, onde ele e o unico parceiro.
- **Desligado** — o vinculo nao difunde nada; serve para a clinica com varios
  veterinarios parceiros, onde o laudo continua nomeando quem encaminhou. O
  vinculo ainda ajuda: no seletor do laudo, os veterinarios da clinica de origem
  aparecem primeiro.

## 3) Nao objetivos

- Nao mexe no parceiro do tipo `clinica`: `clinica_id`, o `unique` e o fluxo de
  convite/login da clinica ficam como estao.
- Nao troca o `laudo.veterinario_parceiro_id` por lista. O laudo continua tendo
  **um** veterinario encaminhador; o que passa a ser plural e o conjunto de
  **destinatarios** do laudo, que ja era plural no banco
  (`portal_partner_release_targets` e unico por `partner_id + exame_id`).
- Nao cria difusao por cidade, por area de atuacao ou por email — a heranca
  implicita que a NFR-002 de `portal-parceiros-externos` proibe continua
  proibida. A difusao aqui e explicita: existe uma linha de vinculo, criada por
  um admin, com o interruptor ligado.
- Nao muda o texto nem o modelo aprovado do WhatsApp (`portalReportAvailable`).

## 4) Contexto e restricoes

- Restricoes tecnicas: o aviso por WhatsApp ao veterinario parceiro ja existe
  (`laudo-aviso-whatsapp-parceiro`, #151/#152, em `stage` e `main`) e grava
  status em tres colunas de valor unico (`laudos.whatsapp_parceiro_status`,
  `_em`, `_erro`). Com N veterinarios por laudo essas colunas viram **resumo**
  da ultima tentativa, e o detalhe por veterinario vai no corpo da resposta e na
  auditoria.
- Restricoes operacionais: stage nao entrega WhatsApp (o modelo aprovado so
  existe na conta de producao) — stage confere interface e persistencia, nao
  entrega. Vale o mesmo combinado de `laudo-aviso-whatsapp-parceiro`.
- Restricao de privacidade: com o interruptor ligado, o veterinario passa a ver
  no portal todos os laudos daquela clinica, inclusive os encaminhados por outro
  profissional da mesma clinica. E consciente, e por isso e opcional e por
  vinculo — nao um default.

## 5) Impacto esperado

- Usuarios impactados: admin do portal (cadastro do parceiro), veterinarios
  parceiros (passam a receber mais laudos), clinicas parceiras (nenhuma
  mudanca).
- Modulos impactados: `portal_partners` (API e tela), `laudos` (liberacao no
  portal e aviso por WhatsApp), banco (tabela nova).
- Risco de regressao: medio no caminho de liberacao de laudo, que hoje e usado
  todo dia. Mitigado mantendo o caminho do veterinario nomeado identico ao atual
  quando nao ha nenhum vinculo com difusao ligada.
