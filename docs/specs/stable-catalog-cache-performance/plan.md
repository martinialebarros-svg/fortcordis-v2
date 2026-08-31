# Plan - stable-catalog-cache-performance

Data: 2026-08-31
Responsavel: Codex / equipe FortCordis
Status: em desenvolvimento

## Etapas

1. Mapear os GETs repetidos de clínicas e serviços e excluir recursos operacionais/dinâmicos.
2. Implementar cache em memória com TTL de cinco minutos, chave por variante de resposta, deduplicação de solicitação e isolamento quando a sessão muda.
3. Aplicar o carregador às páginas que usam os catálogos compartilhados sem alterar suas transformações de dados ou estados de erro.
4. Invalidar todas as variantes de clínicas ou serviços após mutação HTTP bem-sucedida do respectivo recurso.
5. Cobrir TTL, concorrência, falhas, invalidação e mudança de sessão com teste unitário; executar lint, TypeScript, build e guardrail SDD.
6. Validar em stage a navegação autenticada que abre os filtros de Agenda e a aba de Ordens no Financeiro.

## Rollback

Reverter o commit da feature remove o cache somente do cliente. Não há migração, persistência ou alteração de dados remotos.
