# Spec - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19

## Requisitos funcionais

- RF-001: ao excluir um exame sem `id` enquanto o primeiro save esta em voo, a resposta que o criou deve gerar uma exclusao explicita no save seguinte.
- RF-002: selecionar novamente o mesmo exame de catalogo no atendimento deve manter uma unica solicitacao e abrir o item existente.
- RF-003: retries e payloads repetidos sem `id`, para o mesmo `catalogo_exame_id` e atendimento, devem atualizar/reaproveitar o mesmo registro.
- RF-004: um payload com `id` de exame inexistente nao pode criar um novo exame.
- RF-005: o PDF de solicitacao deve refletir somente os exames que permaneceram apos a sincronizacao.

## Preservacao clinica

Exames com laudo, arquivo anexado ou liberacao no portal continuam sujeitos aos bloqueios de exclusao existentes. A correcao nao remove registros clinicos sem uma acao explicita autorizada.

## Criterios de aceitacao

- CA-001: o cenario remover-durante-primeiro-save termina com o exame ausente do estado e do banco.
- CA-002: dois payloads consecutivos do catalogo `Ultrassom abdominal` deixam exatamente um exame no atendimento.
- CA-003: uma atualizacao atrasada com `id` ausente nao cria exame novo.
- CA-004: testes direcionados, typecheck, lint e build concluem sem erro novo.
