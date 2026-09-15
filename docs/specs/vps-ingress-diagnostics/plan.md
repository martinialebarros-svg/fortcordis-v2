# Plano - Diagnostico de entrada TCP/TLS da VPS

1. Criar um probe HTTPS externo limitado a vinte amostras, com timeout curto e
   corpo descartado.
2. Criar um coletor remoto sem comandos mutaveis, com saida agregada da porta
   443, TCP, conntrack, descritores, Nginx e categorias de erro recentes.
3. Executar o coletor por SSH como etapa one-shot do deploy de stage somente
   quando o commit contiver `[vps-ingress-diagnostics]`; isso evita depender
   de um workflow manual fora da branch padrao do GitHub.
4. Cobrir os dois scripts com binarios simulados e validar sintaxe Bash e YAML
   localmente.
5. Publicar o commit marcado somente mediante solicitacao explicita; interpretar
   os contadores junto aos probes antes de qualquer ajuste de infraestrutura.
6. Incluir uma segunda coleta, tambem marcada e agendada por cinco minutos, que
   execute snapshots repetidos e calcule deltas entre amostras e no periodo
   total, em paralelo a probes HTTPS externos.
7. Cobrir o monitor com coletor e relogio simulados, garantindo que valores
   acumulados, picos e erros de configuracao sejam interpretados sem escrita
   ou privilegios adicionais.
8. Executar o monitor pelo arquivo implantado e verificar o SHA por SSH;
   invalidar totais apos reset ou lacuna, usar timestamps reais e timeout por
   coleta, por processo remoto e pela etapa da esteira.

## Reversibilidade

Os scripts apenas leem estado do runner e da VPS. A remocao futura do workflow
e dos scripts e uma alteracao de repositorio independente; nao ha rollback de
infraestrutura porque nenhuma configuracao e modificada.
