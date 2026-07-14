# Specification

## Problema

A rota `DELETE /api/v1/agenda/{agendamento_id}` aceita `admin` e `secretaria`, mas a matriz global de permissoes intercepta a requisicao antes do endpoint e bloqueia o papel `secretaria` quando `papeis_permissoes.excluir` esta desativado para o modulo `agenda`.

## Comportamento esperado

- O papel `secretaria` deve ter `excluir = 1` no modulo `agenda`.
- O papel `admin` permanece com acesso total.
- Outros papeis continuam sujeitos a matriz configurada.
- A exclusao continua gerando auditoria e notificacao em tempo real.

## Implementacao

Uma migracao idempotente atualiza a permissao existente ou cria a linha ausente para `secretaria` no modulo `agenda`.
