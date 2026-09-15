# Spec - atendimento-solicitacao-exame-duplicada

Data: 2026-08-19 (revisado em 2026-08-26)

## Requisitos funcionais

- RF-001: ao excluir um exame sem `id` enquanto o primeiro save esta em voo, a resposta que o criou deve gerar uma exclusao explicita no save seguinte.
- RF-002: selecionar novamente o mesmo exame de catalogo no atendimento deve manter uma unica solicitacao e abrir o item existente.
- RF-003: a defesa contra clique duplo deve valer tambem antes de o React refletir a primeira inclusao no formulario.
- RF-004: um payload com `id` de exame inexistente nao pode criar um novo exame.
- RF-005: o PDF de solicitacao deve refletir somente os exames que permaneceram apos a sincronizacao.
- RF-006: se o usuario continuar digitando enquanto o primeiro autosave esta em
  voo, o `id` criado deve ser incorporado a mesma linha pelo `_localId`, sem
  depender de o texto atual ainda ser igual ao snapshot enviado.
- RF-007: a incorporacao do `id` nao deve mudar a chave React do card nem
  interromper foco/cursor do campo em edicao.
- RF-008: limpar integralmente o nome de uma solicitacao manual ja persistida e
  sem outro conteudo deve enviar `_destroy`; itens com catalogo, painel,
  resultado, observacao, preparo ou anexo nao podem ser apagados implicitamente.

## Preservacao clinica

Exames com laudo, arquivo anexado ou liberacao no portal continuam sujeitos aos bloqueios de exclusao existentes. A correcao nao remove registros clinicos sem uma acao explicita autorizada.

O esvaziamento automatico descrito em RF-008 so se aplica a um card manual sem
conteudo clinico ou vinculo. Qualquer registro protegido continua exigindo o
fluxo explicito de exclusao e a validacao do backend.

## Criterios de aceitacao

- CA-001: o cenario remover-durante-primeiro-save termina com o exame ausente do estado e do banco.
- CA-002: uma segunda selecao imediata do catalogo `Ultrassom abdominal` e ignorada, sem criar outro item local.
- CA-003: uma atualizacao atrasada com `id` ausente nao cria exame novo.
- CA-004: testes direcionados, typecheck, lint e build concluem sem erro novo.
- CA-005: no cenario `Rela` enviado -> texto completo digitado durante o
  round-trip, o estado final contem um unico exame, com o `id` retornado e o
  texto completo.
- CA-006: a chave visual antes e depois de incorporar o `id` permanece igual.
- CA-007: apagar o nome durante o primeiro autosave ou limpar depois um card
  manual vazio produz exclusao explicita; um card com resultado ou catalogo nao
  e elegivel para exclusao implicita.
