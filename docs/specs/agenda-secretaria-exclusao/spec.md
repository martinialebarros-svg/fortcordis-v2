# Specification

## Problema

A rota `DELETE /api/v1/agenda/{agendamento_id}` passou a aceitar `admin` e `secretaria`, mas o cadastro efetivo usa o papel `recepcao`. A migracao `20260714_49` procurou apenas por `secretaria`, atualizou zero linhas e foi registrada como concluida. Assim, a matriz global continuou interceptando a requisicao antes do endpoint.

## Comportamento esperado

- Os papeis `recepcao` e `secretaria`, inclusive variantes acentuadas, devem ter `excluir = 1` no modulo `agenda`.
- A autorizacao do endpoint deve reconhecer o identificador real `recepcao`.
- O papel `admin` permanece com acesso total.
- Outros papeis continuam sujeitos a matriz configurada.
- A exclusao continua gerando auditoria e notificacao em tempo real.

## Implementacao

Uma nova migracao idempotente, `20260714_50`, atualiza a permissao existente ou cria a linha ausente para os identificadores de recepcao e secretaria no modulo `agenda`. A nova versao e necessaria porque producao ja registrou `20260714_49` como aplicada.
