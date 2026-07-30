# Intent - portal-parceiros-externos

Data: 2026-07-29
Responsavel: Codex
Status: approved

## 1) Problema atual

O portal externo da Fort Cordis foi desenhado com foco em `clinica parceira`, assumindo unidade fixa, endereco estruturado e escopo operacional de uma clinica. Esse modelo nao cobre bem o veterinario parceiro volante, que atua em domicilio ou em diferentes locais, encaminha pacientes para exames cardiologicos e tambem precisa receber acesso seguro aos laudos pelo portal.

## 2) Objetivo

Generalizar o portal externo para suportar dois perfis de parceiro, sem criar um segundo portal:
- clinica parceira
- veterinario parceiro

O resultado esperado e permitir convite, ativacao, autenticacao, visualizacao de laudos, filtros e auditoria para os dois perfis, com escopo de acesso rigorosamente limitado aos casos liberados para cada parceiro.

## 3) Nao objetivos

- Criar um portal separado para veterinarios parceiros.
- Reestruturar o modulo operacional de `clinicas` usado em agenda, logistica e financeiro.
- Entregar nesta fase multiusuario por parceiro, hierarquia interna ou permissoes por equipe.
- Alterar o fluxo do tutor no portal.
- Abrir acesso automatico a todos os pacientes de uma clinica ou de um veterinario sem liberacao explicita.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - A entidade `Clinica` existente concentra endereco, geolocalizacao, tabela de preco e comportamento logistico; ela nao deve ser usada sozinha como modelo universal de parceiro externo.
  - O portal atual precisa evoluir por compatibilidade, preservando os acessos ja ativos de clinicas parceiras.
- Restricoes de prazo:
  - A primeira entrega deve priorizar convite, login, liberacao de laudos, busca e gestao do acesso.
- Restricoes regulatorio/operacional:
  - O acesso deve seguir LGPD, mantendo escopo minimo necessario, auditoria de login/download e revogacao segura.
  - O veterinario parceiro pode nao possuir endereco fixo de atendimento; cidade base e contato profissional passam a ser suficientes para o perfil.

## 5) Impacto esperado

- Usuarios impactados:
  - admin Fort Cordis
  - clinicas parceiras
  - veterinarios parceiros volantes
- Modulos impactados:
  - portal externo
  - gestao de convites/acessos
  - liberacao de laudos
  - cadastro administrativo de parceiros
- Risco de regressao:
  - medio, porque o portal atual e clinic-centric e precisara ser generalizado sem perder compatibilidade com clinicas ja ativadas.

## 6) Riscos iniciais

- Risco 1: misturar regras operacionais de clinica e parceiro volante na mesma entidade principal e contaminar agenda/logistica.
- Risco 2: abrir escopo excessivo de visualizacao se a regra de liberacao continuar baseada apenas em clinica e nao em destinatario explicito.
- Risco 3: conflito de login quando o mesmo email tentar representar perfis externos diferentes na fase inicial.

## 7) Perguntas abertas

- Nenhuma bloqueando a spec. Assumir, nesta fase, um login por parceiro externo e um parceiro por email ativo.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
