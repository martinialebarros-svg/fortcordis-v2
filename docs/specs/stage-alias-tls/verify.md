# Verify — Alias HTTPS de stage

Data local: 2026-10-04
Status: DNS e HTTPS corrigidos; smoke público aprovado

Diagnóstico inicial confirmado em `../agenda-preferencias-compactacao/stage-alias.md`:
NXDOMAIN nas duas autoridades e em dois resolvedores públicos; vhost já possui
o alias; o certificado anterior não possuía seu SAN; Nginx tinha sintaxe válida.

O usuário concluiu login no Cloudflare e a zona correta foi conferida. O CNAME
`www.stage` → `stage.fortcordis.com.br` foi salvo com DNS only e TTL de 300 s.
O painel filtrado mostra um registro correspondente. As duas autoridades
`jakub` e `ollie` e os resolvedores `1.1.1.1` e `8.8.8.8` respondem o CNAME
e o A esperado `216.238.116.77`.

Validação local e revisão independente concluídas antes da publicação:

- 14 testes de guards, DNS, layout, backup/restauração, sinais, certificado,
  redirecionamento, renovação, idempotência e integridade privilegiada aprovados.
- YAML, blocos Bash, compilação Python e `git diff --check` aprovados.
- Bootstrap privilegiado usa Python isolado e executa os mesmos bytes validados.
- Teste executa o guard: stage permitido; main e branch de trabalho recusados.
- Nenhuma emissão ACME, reload de Nginx ou dispatch foi feito nesta preparação.

## Execução e resultado observado

- PR #304 incorporou workflow/coletor; PR #305 corrigiu o jitter do dry-run.
  A execução aprovada foi o workflow manual sobre `stage` no SHA
  `23153744e2ac3063cfff954876a80e3d83518886`. Deploy de stage
  [37253117384](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37253117384)
  e reparo [37253410573](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37253410573)
  terminaram em `success`.
- O reparo registrou backup privado em
  `/var/backups/fortcordis-stage-alias/repair-6arsp77b`, `issued=true`, três
  SANs e `complete`. Os oito arquivos protegidos mantiveram seus hashes;
  nenhum rollback real foi necessário. O backup usa cópias/manifest, não tar.
- Certificado Let's Encrypt YR1 válido até 03/01/2027 01:08:50 UTC, com SANs
  exatos stage, app.stage e www.stage. Validação TLS estrita passou. O
  workflow também aprovou `nginx -t`, redirecionamentos, resposta canônica
  e dry-run restrito à linhagem de stage. Renovação conserva
  `authenticator = nginx` e `installer = nginx`.
- Smoke público sem `-k` nem DNS forçado: três hosts de stage com raiz 200,
  Agenda final 200 e API anônima 401; aliases da Agenda redirecionam ao
  canônico. Todos os marcadores esperados foram encontrados nos bundles.
  Os cinco hosts de produção passaram as mesmas três rotas, e o checkout de
  produção permaneceu em `fa9781901ab7fa9f2939551a01d06bec6def38c4`.
  O checkout de stage contém exatamente o SHA do dispatch. Os marcadores
  de bundles provam funcionalidade servida, não identidade de commit.
- Evidência agregada e sem dados de pacientes:
  [completion-2026-10-04.json](evidence/completion-2026-10-04.json).

Este resultado encerra o reparo DNS/TLS. A diferença real de eficiência da
Agenda continua dependente da janela pós completa em 02/11/2026.


## Compatibilidade da renovação instalada

Após o PR #304 (`71c01c0afac00e487f2b81610be0be28b616d4b9`), a leitura do
código instalado do Certbot 1.21 confirmou jitter de 1–480 segundos em `renew`
sem terminal. O limite operacional do comando é 300 segundos. O dispatch
`37252593566` foi cancelado ainda na fila, sem jobs, antes de emissão ou backup.
O dry-run passa a receber `--no-random-sleep-on-renew`, opção confirmada na CLI
instalada, para evitar timeout aleatório; não altera o timer ou renewal em disco.
