# Intent - assistente-ia-admin-gestao

Data: 2026-07-20
Responsavel: Martiniano + Codex
Status: completed

## Objetivo

Disponibilizar ao administrador uma IA de gestao integrada ao FortCordis, capaz de consultar dados operacionais reais, explicar resultados e preparar acoes no sistema usando ferramentas de negocio controladas pelo backend.

## Problema

Informacoes de agenda, faturamento, debitos e operacao estao distribuidas em modulos diferentes. A gestao depende de navegacao manual e de o administrador conhecer previamente os filtros e relatorios corretos. Acoes solicitadas em linguagem natural tambem nao podem ser entregues diretamente ao modelo sem autorizacao, validacao e auditoria.

## Resultado esperado desta primeira versao

- assistente conversacional disponivel apenas para usuarios com papel `admin`;
- consultas sobre faturamento, debitos, agenda e disponibilidade usando dados atuais do banco;
- exclusao de agendamento somente depois de uma confirmacao explicita na interface;
- criacao de agendamento ou reserva somente depois de uma confirmacao explicita na interface;
- mensagem pos-criacao pronta para copiar ou abrir manualmente no WhatsApp da clinica ou do tutor;
- conversas persistidas por administrador para continuidade entre acessos;
- chamadas da IA e acoes aprovadas com trilha auditavel;
- nenhuma capacidade de SQL livre, shell, acesso irrestrito ao banco ou escrita generica.

## Nao objetivos desta iteracao

- liberar o assistente para recepcao, veterinarios ou clinicas parceiras;
- gerar ou alterar laudos automaticamente;
- permitir criacao/edicao generica de registros fora do fluxo controlado de agenda;
- treinar ou ajustar um modelo com dados do FortCordis;
- executar acoes destrutivas sem confirmacao humana;
- implantar em stage ou producao neste ciclo local.

## Riscos principais

- vazamento de dados pessoais ou financeiros por ferramentas muito amplas;
- ambiguidade ao identificar clinicas, servicos ou agendamentos;
- exclusao do registro errado por mudanca entre a solicitacao e a aprovacao;
- custo ou latencia excessivos por loops sem limite;
- dependencia da disponibilidade e permissao do modelo configurado na OpenAI.
