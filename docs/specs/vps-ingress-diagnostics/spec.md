# Especificacao - Diagnostico de entrada TCP/TLS da VPS

## Requisitos funcionais

- RF-001: o deploy de stage deve executar uma unica coleta direcionada a stage
  somente quando a mensagem do commit contiver
  `[vps-ingress-diagnostics]`; sem o marcador, nao deve haver probe ou SSH
  adicional.
- RF-002: cada execucao deve realizar duas series de vinte probes HTTPS sem
  corpo, cookies ou cabecalhos de autenticacao, uma antes e outra depois da
  coleta remota.
- RF-003: cada probe deve registrar somente rotulo, numero da tentativa, codigo
  de saida do curl, status HTTP, IP remoto, versao HTTP e tempos de conexao,
  TLS e total.
- RF-004: o coletor remoto deve reportar apenas contagens para listeners,
  SYN-RECV e conexoes estabelecidas na porta 443; nao pode listar endpoints de
  clientes.
- RF-005: o coletor deve incluir `somaxconn`, `tcp_max_syn_backlog`, uso e
  limite de conntrack, limite global de arquivos, `file-nr`, contadores
  selecionados de `TcpExt`, estado/limites do Nginx e total de categorias de
  erro do Nginx nos ultimos trinta minutos.
- RF-006: ausencia de permissao ou ferramenta deve ser registrada como
  `unavailable`, sem tentativa de elevar privilegio.
- RF-007: timeout HTTP/TLS e um dado diagnostico; deve compor o resumo de
  falhas sem interromper as demais tentativas da mesma serie.

## Requisitos de seguranca e operacao

- NFR-001: nenhum script pode conter `sudo`, reinicio, reload, escrita de
  arquivo ou limpeza de recurso remoto.
- NFR-002: os logs nao podem incluir secrets, arquivos de configuracao, linhas
  brutas de journal, corpo HTTP, cookies ou cabecalhos de autenticacao.
- NFR-003: a coleta deve usar a etapa existente de deploy de stage, sem criar
  um workflow manual dependente da branch padrao do GitHub.
- NFR-004: o workflow nao altera stage nem producao e nao constitui prova de
  uma correcao; seus dados apenas orientam uma alteracao posterior autorizada.
