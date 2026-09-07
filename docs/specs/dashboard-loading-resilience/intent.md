# Intent - dashboard-loading-resilience

Data: 2026-09-07
Responsável: Codex / equipe FortCordis

## Problema

O Dashboard autenticado dependia de uma chamada de Agenda antes das demais leituras e convertia a falha ou timeout de qualquer uma das quatro leituras em indisponibilidade total do painel. A conectividade direta à VPS apresentou timeouts intermitentes antes do TLS; a tela deve comunicar dados indisponíveis sem substituir dados não carregados por zero.

## Objetivo

Permitir que Agenda, Pacientes, Clínicas e Serviços carreguem de modo independente, cancelável e recuperável, preservando a investigação e a correção de infraestrutura como trabalho separado.

## Fora de escopo

- Alterar regras de autorização, payloads ou rotas de API.
- Repetir automaticamente requisições ou ocultar falhas de rede.
- Alterar Nginx, DNS, firewall, banco ou a VPS.
