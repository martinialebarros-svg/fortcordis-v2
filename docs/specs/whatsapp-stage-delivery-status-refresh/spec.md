# Spec - whatsapp-stage-delivery-status-refresh

## Requisitos funcionais

- RF-001: a tela `/whatsapp-stage` deve atualizar automaticamente as mensagens da conversa selecionada a cada cinco segundos.
- RF-002: a atualizacao automatica deve refletir transicoes de status persistidas pelo webhook, incluindo `sent`, `delivered`, `read` e `failed`.
- RF-003: a atualizacao automatica deve ser silenciosa e preservar as mensagens visiveis durante a consulta.
- RF-004: respostas atrasadas de uma conversa anteriormente selecionada nao devem sobrescrever a conversa atual.
- RF-005: a interface deve oferecer uma acao manual `Atualizar` para consulta imediata.

## Requisitos de seguranca e privacidade

- RS-001: as consultas devem continuar usando o bearer token existente e a rota protegida `/whatsapp/conversations/:id/messages`.
- RS-002: nenhum token, payload bruto ou dado adicional do cliente deve ser exibido pela atualizacao.

## Criterios de aceitacao

- CA-001: uma mensagem inicialmente exibida como `sent` passa a `delivered` sem recarregar a pagina quando a API retorna o novo status.
- CA-002: a atualizacao automatica nao substitui o fluxo de mensagens por um estado visual de carregamento.
- CA-003: o botao `Atualizar` fica indisponivel sem conversa selecionada ou durante uma consulta explicita.
- CA-004: lint, teste focado e build do frontend permanecem verdes.
