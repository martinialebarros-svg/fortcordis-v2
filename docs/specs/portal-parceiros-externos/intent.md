# Intent - portal-parceiros-externos

Data: 2026-07-30
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Problema atual

O portal externo hoje foi desenhado com foco principal em clinicas parceiras. Esse modelo cobre bem unidades com endereco fixo, mas nao representa corretamente veterinarios parceiros que atuam de forma volante, fazem atendimento domiciliar ou encaminham pacientes sem operar como clinica tradicional.

Na pratica, isso cria dois atritos:
- a operacao nao tem um cadastro proprio para esses parceiros;
- a liberacao de laudos para acesso externo continua mais acoplada ao conceito de clinica do que ao conceito real de parceiro autorizado.

## 2) Objetivo

Generalizar o portal para um modelo de `parceiro externo`, mantendo compatibilidade com clinicas parceiras ja ativas e adicionando suporte nativo a veterinarios parceiros.

Esse novo modelo deve permitir:
- cadastrar parceiro externo por tipo;
- convidar, ativar e autenticar o parceiro com o mesmo padrao de seguranca do portal;
- mostrar ao parceiro apenas os exames e laudos explicitamente liberados para ele;
- dar a operacao uma visao administrativa unica de clinicas e veterinarios parceiros.

## 3) Nao objetivos

- Nao substituir o fluxo do tutor nesta iteracao.
- Nao implantar SSO corporativo ou login por terceiros.
- Nao transformar o link enviado por WhatsApp em acesso automatico.
- Nao concluir nesta fase a liberacao multi-destinatario completa em toda a operacao de laudos.
- Nao fechar ainda todo o fluxo de telemedicina sem agendamento em producao.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - clinicas parceiras existentes precisam continuar funcionando sem novo cadastro manual;
  - o escopo de acesso deve continuar preso ao destinatario explicitamente liberado;
  - a autenticacao do parceiro deve reutilizar o padrao seguro do portal, com sessao curta, refresh dedicado e MFA quando exigido;
  - a camada nova deve conviver com contratos legados ainda usados por clinicas.
- Restricoes operacionais:
  - veterinario parceiro pode nao ter endereco fixo de atendimento;
  - a operacao precisa conseguir convidar, reenviar acesso e acompanhar status sem agir direto no banco;
  - notificacoes e convites nao podem expor dados sensiveis do paciente.
- Restricoes de rollout:
  - a entrega precisa entrar em stage sem bloquear o acesso atual das clinicas;
  - o rollout deve permitir validar veterinarios parceiros sem reabrir regressao no portal das clinicas.

## 5) Impacto esperado

- Usuarios impactados:
  - equipe administrativa Fort Cordis;
  - clinicas parceiras ja onboardadas;
  - veterinarios parceiros que encaminham pacientes e precisam consultar laudos liberados.
- Modulos impactados:
  - backend do portal;
  - migracoes/modelagem de parceiro externo;
  - tela administrativa do portal;
  - rotas publicas e autenticadas do parceiro.
- Resultado esperado:
  - o portal passa a representar melhor a operacao real de parceiros externos, sem forcar todo encaminhamento a nascer como clinica.

## 6) Riscos iniciais

- Risco 1: migrar a modelagem para parceiro externo e quebrar o acesso de clinicas ja ativas.
- Risco 2: ampliar o modelo sem manter escopo estrito por destinatario e gerar vazamento entre parceiros.
- Risco 3: onboarding de veterinario parceiro ficar incompleto se o admin conseguir cadastrar, mas nao convidar e autenticar ponta a ponta.
- Risco 4: a operacao assumir que a entrega ja cobre liberacao multi-destinatario e telemedicina completa, quando esta fase ainda fecha principalmente fundacao, admin e autenticacao do parceiro.

## 7) Perguntas abertas

- Pergunta 1: em qual fase o fluxo de liberacao multi-destinatario sera promovido como comportamento padrao do laudo?
- Pergunta 2: o fluxo de telemedicina sem agendamento vai nascer dentro de `Laudos`, `Atendimento` ou como fluxo dedicado?
- Pergunta 3: veterinarios parceiros terao um unico responsavel por conta no primeiro rollout ou mais de um usuario por parceiro?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Diferenca entre clinica parceira e veterinario parceiro esta explicita.
- [x] Restricoes de compatibilidade e seguranca estao registradas.
- [x] Riscos iniciais estao mapeados.
- [x] Escopo desta fase esta separado do que continua para proximas entregas.
