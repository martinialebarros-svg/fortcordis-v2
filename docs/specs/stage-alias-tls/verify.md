# Verify — Alias HTTPS de stage

Data local: 2026-10-04
Status: DNS corrigido; reparo TLS preparado para execução protegida

Diagnóstico confirmado em `../agenda-preferencias-compactacao/stage-alias.md`:
NXDOMAIN nas duas autoridades e em dois resolvedores públicos; vhost já possui
o alias; certificado atual não possui seu SAN; Nginx tem sintaxe válida.

O usuário concluiu login no Cloudflare e a zona correta foi conferida. O CNAME
`www.stage` → `stage.fortcordis.com.br` foi salvo com DNS only e TTL de 300 s.
O painel filtrado mostra um registro correspondente. A autoridade `jakub` e
os resolvedores `1.1.1.1` e `8.8.8.8` já respondem o CNAME e o A esperado
`216.238.116.77`. Isso comprova apenas DNS; TLS ainda depende da execução.

Validação local e revisão independente concluídas antes da publicação:

- 14 testes de guards, DNS, layout, backup/restauração, sinais, certificado,
  redirecionamento, renovação, idempotência e integridade privilegiada aprovados.
- YAML, blocos Bash, compilação Python e `git diff --check` aprovados.
- Bootstrap privilegiado usa Python isolado e executa os mesmos bytes validados.
- Teste executa o guard: stage permitido; main e branch de trabalho recusados.
- Nenhuma emissão ACME, reload de Nginx ou dispatch foi feito nesta preparação.

As evidências de execução TLS serão acrescentadas após o resultado real.
