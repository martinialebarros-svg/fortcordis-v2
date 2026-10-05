# Spec — Alias HTTPS de stage

## Contrato

- RF-001: o DNS é CNAME `www.stage` para `stage.fortcordis.com.br`, TTL 300,
  DNS only, na zona `fortcordis.com.br`. Nenhum outro registro é modificado.
- RF-002: o reparo TLS só atende a linhagem `stage.fortcordis.com.br` e os SANs
  `stage.fortcordis.com.br`, `app.stage.fortcordis.com.br` e
  `www.stage.fortcordis.com.br`. Não recebe domínios ou comandos arbitrários.
- RF-003: execução manual restrita à ref `stage`, com checkout da mesma ref e
  serialização com os deploys da VPS. Credenciais existentes são mantidas fora
  dos logs e dos argumentos dos processos que as consomem.
- RF-004: antes da emissão, conferir ambiente, DNS, vhost e sintaxe; guardar
  backup privado da linhagem/vhost de stage e hashes dos arquivos de produção.
- RF-005: usar HTTP-01 pelo plugin Nginx existente. Só recarregar configuração
  válida; conferir os três SANs, HTTPS estrito e renovação restrita a stage.
- RF-006: falhas exigem restauração do backup de stage quando apropriado; não
  remover dados nem restaurar certificados/vhosts de produção. O alias DNS novo
  pode ser removido para reverter sua publicação.

## Aceitação

- CA-001: hosts/SANs/ref são fixos e condições incompatíveis interrompem o reparo.
- CA-002: backup e validação precedem emissão/reload; produção permanece com
  os mesmos hashes e os nomes anteriores de stage continuam válidos.
- CA-003: DNS público resolve o alias; HTTPS estrito passa; Agenda termina em
  200 no canônico e API sem credenciais permanece protegida.
- CA-004: a renovação de stage passa em dry-run sem deixar método manual.

O procedimento detalhado, alternativas e rollback ficam em
`../agenda-preferencias-compactacao/stage-alias.md`. Criar somente o CNAME não
encerra o reparo; a janela entre publicação DNS e emissão HTTPS só afeta o alias
novo, que antes era inexistente.
