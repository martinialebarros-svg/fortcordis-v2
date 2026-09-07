# Intent - Diagnostico de entrada TCP/TLS da VPS

## Problema

O Dashboard pode carregar normalmente e, em outras tentativas, a conexao ao
mesmo host expira antes da negociacao TLS. Como stage e producao compartilham
o IP publico da VPS, a telemetria iniciada no FastAPI nao registra esses
eventos de transporte.

## Objetivo

Disponibilizar diagnosticos explicitamente acionados no deploy de stage e
estritamente somente-leitura para correlacionar probes HTTPS independentes com
o estado agregado da porta 443, do kernel e do Nginx. A segunda etapa mede
deltas por uma janela limitada, separando contadores historicos de pressao que
ocorre durante a observacao.

## Escopo

- Executar somente quando o commit de stage incluir o marcador
  `[vps-ingress-diagnostics]`.
- Amostrar `https://app.stage.fortcordis.com.br/dashboard` antes e depois da
  coleta na VPS, descartando o corpo e sem cookies ou credenciais.
- Coletar contagens agregadas de sockets, filas TCP, contadores do kernel,
  limites de arquivo e estado do Nginx.
- Registrar apenas metadados de transporte e totais de erro do Nginx.
- Executar, somente com o marcador `[vps-ingress-monitor]`, uma janela de
  aproximadamente cinco minutos com trinta amostras da VPS e trinta probes
  HTTPS externos em paralelo (ate oito minutos na serie externa com timeouts).
- Registrar picos de ocupacao e deltas de contadores TCP sem listar conexoes
  individuais nem enderecos de clientes.

## Fora de escopo

- Alterar Nginx, firewall, DNS, Cloudflare, servicos, configuracoes ou dados.
- Reiniciar/recarregar processos, executar comandos com `sudo` ou imprimir
  configuracoes, logs brutos, URLs requisitadas ou valores de secrets.
- Promover qualquer versao para producao.
