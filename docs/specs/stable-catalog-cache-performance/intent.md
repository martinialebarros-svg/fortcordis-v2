# Intent - stable-catalog-cache-performance

Data: 2026-08-31
Responsavel: Codex / equipe FortCordis
Status: em desenvolvimento

## Problema

As listas estáveis de clínicas e serviços são consultadas novamente em páginas que compartilham a mesma sessão autenticada. Isso repete leituras já válidas em Agenda, Financeiro, Atendimento, relatórios e fluxos administrativos, aumentando trabalho de frontend e API sem trazer dados novos.

## Objetivo

Manter em memória, por sessão, catálogos de clínicas e serviços durante uma janela curta e explícita. A mesma lista/variante deve compartilhar uma solicitação pendente, ser reutilizada dentro do TTL e ser descartada após uma mutação bem-sucedida do respectivo catálogo.

## Fora de escopo

- Dados de pacientes, tutores, atendimentos, agenda, transações, ordens, filas ou dados clínicos.
- Persistência em disco, `localStorage` ou cache entre sessões.
- Alteração de contratos de API, paginação ou regras de autorização.

## Riscos

- Entregar uma lista desatualizada após um cadastro, edição ou exclusão.
- Compartilhar conteúdo entre sessões diferentes no mesmo navegador.
- Transformar uma falha de rede em estado armazenado e impedir nova tentativa.
