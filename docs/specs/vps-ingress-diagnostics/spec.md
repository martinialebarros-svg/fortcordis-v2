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
  TLS e total, com timestamp UTC de conclusao para correlacao temporal.
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
- RF-008: quando o commit de stage contiver `[vps-ingress-monitor]`, o deploy
  deve iniciar uma janela limitada a trinta amostras a cada dez segundos na
  VPS e trinta probes HTTPS externos com o mesmo intervalo.
- RF-009: cada amostra do monitor deve registrar apenas ocupacao atual de
  `SYN-RECV`, conexoes estabelecidas, conntrack e correspondencias no journal
  do Nginx nos ultimos 30 minutos; entre amostras deve registrar deltas dos
  contadores TCP selecionados. A janela do journal e movel: nao deve ser
  interpretada como um contador cumulativo nem como cobertura de error.log.
- RF-010: o resumo deve conter picos de ocupacao e delta total da janela. Um
  contador ausente, invalido ou reiniciado deve ser `unavailable`, nunca um
  delta negativo inferido. Uma lacuna ou retrocesso invalida o total ate o fim
  da execucao, mesmo se o contador voltar a superar o valor inicial.
- RF-011: o monitor remoto deve executar por caminho real no checkout stage,
  depois de confirmar que o SHA implantado corresponde ao commit do workflow.
  Deve registrar tempo efetivamente transcorrido e timestamp UTC; os contadores
  TcpExt sao globais ao host, compartilhados com producao e outras portas.

## Requisitos de seguranca e operacao

- NFR-001: nenhum script pode conter `sudo`, reinicio, reload, escrita de
  arquivo ou limpeza de recurso remoto.
- NFR-002: os logs nao podem incluir secrets, arquivos de configuracao, linhas
  brutas de journal, corpo HTTP, cookies ou cabecalhos de autenticacao.
- NFR-003: a coleta deve usar a etapa existente de deploy de stage, sem criar
  um workflow manual dependente da branch padrao do GitHub.
- NFR-004: a etapa diagnostica nao modifica configuracoes ou dados. O workflow
  que a hospeda faz o deploy normal em stage; os resultados da coleta nao
  constituem prova de uma correcao.
- NFR-005: o agendamento entre primeira e ultima amostra e limitado a no maximo
  900 segundos. Cada coleta tem timeout de 8 segundos e tolerancia de 2 para
  encerramento; falhas sao sinalizadas e resultam em status final nao zero.
  Na esteira, a execucao remota tem limite de 360 segundos e a etapa completa
  tem limite de nove minutos. Nao
  pode executar `sudo`, comandos de escrita, mudancas de servico, coleta de
  corpo HTTP, cookies, cabecalhos autenticados ou dados de clientes.
- NFR-006: probes ignoram configuracao implicita do curl e aceitam somente HTTPS,
  inclusive em redirecionamentos. Com 30 tentativas, intervalo de dez segundos
  apos cada resposta e timeout de seis segundos, a serie externa pode levar
  ate aproximadamente oito minutos se todas as tentativas demorarem o limite.
