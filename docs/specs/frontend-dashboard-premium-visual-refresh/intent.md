# Intent - frontend-dashboard-premium-visual-refresh

Responsavel: Equipe FortCordis
Data: 2026-07-10

## Contexto

O dashboard operacional da Fort Cordis ja concentrava os indicadores corretos, mas a hierarquia visual estava pesada: o cabecalho competia com os cards, o empty state da agenda cortava parte do ECG e a sidebar ocultava nomes longos de empresa. A tela precisava parecer mais madura para uso SaaS B2B em saude, mantendo identidade de cardiologia veterinaria e sem alterar contratos de API.

## Objetivo

Elevar a aparencia e a legibilidade do dashboard protegido, criando uma base visual reaproveitavel para outras telas do sistema.

## Fora de escopo

- Alterar endpoints, banco de dados, regras de agenda ou autenticacao.
- Reescrever modulos internos como Agenda, Pacientes, Financeiro ou Laudos neste ciclo.
- Introduzir bibliotecas novas de UI.

## Riscos

- Excesso de ornamentacao prejudicar leitura operacional.
- Mudanca no shell protegido afetar navegacao, logout ou branding por clinica.
- Ajustes visuais criarem overflow em notebooks e telas menores.
