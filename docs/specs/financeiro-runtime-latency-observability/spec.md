# Especificação — PERF-19: latência de Ordens e Cobranças

## Contrato funcional

- RF-001: o monitor registra o caminho exato
  `GET /api/v1/ordens-servico` sob o rótulo fixo
  `/api/v1/ordens-servico`.
- RF-002: o monitor registra o caminho exato
  `GET /api/v1/ordens-servico/cobrancas` sob rótulo próprio.
- RF-003: as duas rotas aparecem separadas no resumo administrativo já
  existente, com quantidade, média, p50, p95, p99, SQL, pool, 5xx e release.
- RF-004: detalhes, PDFs, WhatsApp e mutações de Ordens não entram nesses dois
  grupos exatos.

## Configuração e limites

- `RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS` continua aceitando no máximo cinco
  prefixos e preserva a cobertura operacional anterior.
- `RUNTIME_HTTP_LATENCY_EXACT_ENDPOINTS` aceita no máximo cinco caminhos exatos
  e, por padrão, contém as duas leituras financeiras deste incremento.
- Itens acima de qualquer limite são ignorados com aviso explícito no relatório
  de runtime; não pode haver truncamento silencioso.
- Se o mesmo caminho estiver nas duas configurações, prevalece a rota exata
  `GET`; o prefixo duplicado é removido com aviso para não agregar subrotas.
- A lista combinada continua limitada a dez rótulos e ao limite de amostras já
  definido por endpoint.

## Privacidade e confiabilidade

- A resolução usa `request.url.path`; query string, `search`, filtros, IDs,
  destinatários e payloads não são persistidos.
- Somente o método `GET` pode corresponder a uma rota exata. Prefixos existentes
  preservam seu comportamento anterior.
- A amostra guarda apenas rótulo fixo, release, status, tempos e instante UTC.
- Persistência e limpeza continuam posteriores à resposta e tolerantes a falha.
- O endpoint agregado permanece restrito ao papel `admin`.

## Critérios de aceitação

- CA-001: os cinco prefixos anteriores e as duas rotas exatas ficam ativos ao
  mesmo tempo.
- CA-002: uma amostra de Ordens não altera Cobranças e vice-versa.
- CA-003: `GET /api/v1/ordens-servico/{id}` e método não-GET no caminho base não
  alteram a métrica exata de Ordens.
- CA-004: configuração de seis rotas exatas mantém cinco e emite aviso.
- CA-005: testes focados, suíte de observabilidade e guardrail SDD passam.
- CA-006: a leitura operacional só é conclusiva com release correto,
  `truncated=false` e amostra representativa; a meta inicial continua p95 menor
  que 1.200 ms para APIs de listagem.
