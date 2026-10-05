# Alias de stage: DNS e TLS

## Estado e escopo

Diagnóstico somente leitura realizado em 04/10/2026, horário de Fortaleza
(05/10/2026 UTC). Este documento prepara a intervenção; **nenhuma alteração de
DNS, certificado ou Nginx foi executada** nesta etapa.

Objetivo: tornar `www.stage.fortcordis.com.br` acessível como alias de stage,
preservando os hosts e certificados de produção. O Nginx já atende esse nome.
Não usar `scripts/provision_institutional_nginx.sh`: seus defaults pertencem ao
site institucional de produção e não são apropriados a este reparo.

## Evidências confirmadas

| Item | Resultado |
| --- | --- |
| Provedor DNS | Cloudflare, autoridades `jakub.ns.cloudflare.com` e `ollie.ns.cloudflare.com` |
| `www.stage` | NXDOMAIN nas duas autoridades e em 1.1.1.1/8.8.8.8 |
| `stage` | A para `216.238.116.77`, TTL 300 |
| `app.stage` | CNAME para `stage.fortcordis.com.br`, TTL 300 |
| Certificado servido com SNI `www.stage` | CN `stage.fortcordis.com.br`; SANs apenas `stage.fortcordis.com.br` e `app.stage.fortcordis.com.br` |
| Validade do certificado | 24/09/2026 a 23/12/2026, Let's Encrypt |
| HTTPS estrito com DNS forçado | Falha curl 60: nome ausente no certificado |
| Roteamento, ignorando TLS apenas para diagnóstico | `/` 200; `/agenda` 307 para `https://app.stage.fortcordis.com.br/agenda` |
| Nginx de stage | `/etc/nginx/sites-available/fortcordis-stage`; nomes stage, www.stage e app.stage presentes em 80/443 |
| Upstreams | Frontend `127.0.0.1:3001`, API `127.0.0.1:8001` |
| Sintaxe Nginx | `sudo -n /usr/sbin/nginx -t` aprovado |
| Certbot | `/usr/bin/certbot`, versão 1.21.0 |
| Renovação atual de stage | `authenticator = nginx`, `installer = nginx` |
| Challenge webroot | Nenhum `location` de `acme-challenge`/webroot identificado nos vhosts/snippets; a existência de `/var/lib/letsencrypt` não comprova um webroot publicado |

O teste com `-k` não aprova TLS. Criar somente o DNS deixaria um erro de
certificado. Não é necessário modificar `server_name` nem apontar para portas
de produção.

## Acesso existente e condição para executar

- SSH verificado como `martiniano@216.238.116.77`, com `BatchMode=yes` e a chave
  local já usada pelo projeto. Não criar novas chaves ou usuários.
- `sudo -n -l` permite sem senha `/usr/sbin/nginx -t` e
  `/bin/systemctl reload nginx`, além dos reinícios de serviços já previstos.
  **Certbot e cópia/restauração dos certificados não estão em NOPASSWD.**
- A conta possui permissão sudo geral com autenticação. Para os comandos de
  remediação abaixo, utilizar a autenticação sudo existente numa sessão de
  operador ou o mecanismo protegido já usado no deploy. Não ampliar sudoers,
  não cadastrar uma nova credencial e não colocar senha em argumentos, histórico,
  código, documentos ou saída. `VPS_SUDO_PASSWORD` é documentado no runbook como
  secret existente de deploy; sua existência não torna seu valor recuperável
  pela API do GitHub nem disponível nesta sessão.
- Não foram procurados arquivos de senha sudo. Não há arquivo de senha sudo
  identificado ou pressuposto por este procedimento.
- Não foi encontrada credencial DNS utilizável nas fontes pertinentes
  inspecionadas. O OAuth local do Wrangler está expirado desde 02/09/2026 e não
  tem escopo de edição DNS; não foi renovado. Os nomes de secrets GitHub
  inspecionados não indicam credencial Cloudflare/DNS.
- A sessão Cloudflare do navegador estava sem login; o usuário foi orientado a
  entrar. Uma sessão existente permite operar DNS pelo painel, sem criar token
  API. Login Cloudflare sozinho não concede o sudo necessário ao Certbot.

Se a autenticação sudo existente não estiver disponível, parar antes de emitir
certificado/publicar o alias. Não usar os comandos de reinício permitidos para
contornar a ausência dessa autenticação.

## Registro exato

Na zona **fortcordis.com.br**, criar somente:

| Campo | Valor |
| --- | --- |
| Tipo | CNAME |
| Nome | `www.stage` |
| Destino | `stage.fortcordis.com.br` |
| Proxy | DNS only / nuvem cinza (`proxied=false`) |
| TTL | 300 segundos |

Não alterar `stage`, `app.stage`, apex, MX, certificados ou DNS de produção.
Não criar A/AAAA junto do CNAME. Universal SSL Cloudflare em zona completa não
cobre normalmente nomes desse nível: não ativar proxy como solução para o SAN
ausente. [Referência oficial](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/).

O SOA observado anuncia 1.800 segundos de cache negativo. Resolvedores que
tenham guardado o NXDOMAIN podem demorar cerca de 30 minutos para atualizar,
mesmo que o novo registro tenha TTL 300.

## Comandos somente leitura

Executar localmente, sem token ou dados de aplicação:

```bash
dig @jakub.ns.cloudflare.com www.stage.fortcordis.com.br A +noall +comments +answer +authority
dig @ollie.ns.cloudflare.com www.stage.fortcordis.com.br CNAME +noall +comments +answer +authority
dig @1.1.1.1 www.stage.fortcordis.com.br A +noall +comments +answer +authority
dig @8.8.8.8 www.stage.fortcordis.com.br A +noall +comments +answer +authority
openssl s_client -connect 216.238.116.77:443 -servername www.stage.fortcordis.com.br </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
curl --noproxy '*' --resolve www.stage.fortcordis.com.br:443:216.238.116.77 -sSI --max-time 20 https://www.stage.fortcordis.com.br/agenda
```

Na sessão SSH existente:

```bash
sudo -n -l
sudo -n /usr/sbin/nginx -t
certbot --version
awk '/^(authenticator|installer|webroot_path)[[:space:]]*=/' /etc/letsencrypt/renewal/stage.fortcordis.com.br.conf
```

Não imprimir chaves privadas, senhas, arquivos `.env`, credenciais API ou logs
amplos da aplicação. Valores TXT de challenge devem ser transferidos entre o
prompt Certbot e o painel Cloudflare, sem copiá-los para relatórios.

## Preparação comum — mutações ainda não executadas

Executar somente na intervenção autorizada, com sudo autenticado pelo acesso
existente. Guardar o caminho impresso por `printf` para rollback; o diretório e
o arquivo de backup contêm material privado e permanecem somente na VPS.

```bash
STAGE_ALIAS_BACKUP="/var/backups/fortcordis-stage-alias/$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -d -m 700 "$STAGE_ALIAS_BACKUP"
sudo tar -C / -czf "$STAGE_ALIAS_BACKUP/stage-tls.tar.gz" \
  etc/nginx/sites-available/fortcordis-stage \
  etc/letsencrypt/live/stage.fortcordis.com.br \
  etc/letsencrypt/archive/stage.fortcordis.com.br \
  etc/letsencrypt/renewal/stage.fortcordis.com.br.conf
sudo chmod 600 "$STAGE_ALIAS_BACKUP/stage-tls.tar.gz"
sudo cp -p /etc/letsencrypt/renewal/stage.fortcordis.com.br.conf "$STAGE_ALIAS_BACKUP/stage-renewal.conf"
sudo chmod 600 "$STAGE_ALIAS_BACKUP/stage-renewal.conf"
printf '%s\n' "$STAGE_ALIAS_BACKUP"
```

Antes e depois, comparar hashes dos vhosts de produção e dos seus certificados
públicos; registrar somente hashes e caminhos, nunca chaves privadas. A mudança
é limitada à linhagem `stage.fortcordis.com.br`. Não executar `certbot renew`
sem `--cert-name`, nem `certbot --nginx` sem os nomes explícitos.

```bash
sudo sha256sum \
  /etc/nginx/sites-available/fortcordis-app \
  /etc/nginx/sites-available/fortcordis-com-br \
  /etc/nginx/sites-available/fortcordis-www \
  /etc/letsencrypt/live/app.fortcordis.com.br/fullchain.pem \
  /etc/letsencrypt/live/fortcordis.com.br/fullchain.pem \
  /etc/letsencrypt/live/fortcordis.com/fullchain.pem \
  | sudo tee "$STAGE_ALIAS_BACKUP/prod.before.sha256"
```

## Alternativa A — DNS-01 antes do CNAME

Preferível quando a sessão Cloudflare e o sudo existente estiverem disponíveis:
permite provar TLS antes de tornar o alias resolvível. Não necessita criar token
API: os TXT temporários podem ser operados no painel autenticado.

1. Fazer o backup acima e manter o CNAME ausente.
2. Na sessão sudo/TTY, iniciar a emissão manual para a mesma linhagem:

```bash
sudo /usr/bin/certbot certonly --manual --preferred-challenges dns \
  --cert-name stage.fortcordis.com.br --expand \
  -d stage.fortcordis.com.br \
  -d app.stage.fortcordis.com.br \
  -d www.stage.fortcordis.com.br
```

3. Criar **somente** os TXT `_acme-challenge` solicitados nessa execução, com
   valores gerados pelo Certbot. Preservar quaisquer TXT de desafios já existentes;
   se um nome já possuir TXT, adicionar o valor necessário sem substituir o
   restante. Confirmar nas duas autoridades antes de continuar o prompt. Os
   valores não podem ser antecipados neste documento.
4. Após emissão bem-sucedida, testar e carregar o certificado:

```bash
sudo -n /usr/sbin/nginx -t && sudo -n /bin/systemctl reload nginx
```

5. O `curl --resolve` **sem `-k`** deve aprovar o hostname; os três SANs precisam
   estar presentes. Então criar o CNAME exato e validar DNS/HTTPS publicamente.
6. Remover apenas os valores TXT criados por esta execução, após emissão e
   validação. Não apagar RRsets compartilhados.
7. **Restabelecer renovação automática:** `--manual` altera os parâmetros de
   renovação. Não encerrar deixando renovação manual sem hooks. Nesta instalação
   1.21.0, restaurar somente a configuração anterior da mesma linhagem, mantendo
   o certificado novo, e comprovar HTTP-01 com o alias já resolvendo:

```bash
sudo cp -p "$STAGE_ALIAS_BACKUP/stage-renewal.conf" /etc/letsencrypt/renewal/stage.fortcordis.com.br.conf
sudo /usr/bin/certbot renew --cert-name stage.fortcordis.com.br --dry-run
```

O arquivo anterior aponta para a mesma linhagem e usa o autenticador/instalador
Nginx. Foi verificado no código instalado de Certbot 1.21.0
(`_internal/storage.py`, método `names`) que os nomes são lidos do certificado
atual; a restauração do arquivo de renovação não remove o SAN novo. Ainda assim,
o dry-run é o critério de aceitação da renovação. Ele aciona validação ACME de
teste e alterações temporárias de challenge; não é uma operação somente leitura.
Não usar `certbot reconfigure`: sua disponibilidade não foi confirmada nessa
versão antiga.

## Alternativa B — HTTP-01 após criar o alias

Adequada com a sessão Cloudflare e sudo existentes, sem credencial DNS API e
sem mudar o método de renovação atual. Existe uma janela curta de erro TLS
**somente no alias novo**, que antes respondia NXDOMAIN; os hosts de stage
existentes continuam com o certificado atual até o sucesso da emissão.

1. Fazer o backup comum.
2. Criar o CNAME DNS only/TTL 300 e confirmar resolução nas autoridades.
   Conferir acesso público à porta 80; não presumir propagação porque o painel
   aceitou a alteração.
3. Emitir explicitamente a linhagem de stage, mantendo todos os SANs atuais:

```bash
sudo /usr/bin/certbot certonly --nginx \
  --cert-name stage.fortcordis.com.br --expand \
  -d stage.fortcordis.com.br \
  -d app.stage.fortcordis.com.br \
  -d www.stage.fortcordis.com.br
sudo -n /usr/sbin/nginx -t && sudo -n /bin/systemctl reload nginx
```

4. Conferir SANs, HTTPS estrito e renovação:

```bash
sudo /usr/bin/certbot renew --cert-name stage.fortcordis.com.br --dry-run
```

O plugin Nginx existente prepara temporariamente o challenge HTTP-01; não
depende de um webroot preexistente. Não instalar plugins, alterar firewall,
criar serviço de challenge ou editar hosts de produção como parte deste fluxo.
Se a emissão falhar, não repetir sem diagnosticar o erro para evitar limites
ACME; aplicar rollback do alias novo conforme abaixo.

## Aceitação e rollback

Aceitar somente quando:

- DNS autoritativo e resolvedores públicos reconhecem o CNAME.
- HTTPS estrito do alias passa; SANs incluem os três nomes de stage.
- `/` retorna 200; `/agenda` redireciona ao canônico e termina em 200.
- `stage` e `app.stage` continuam funcionando; hashes dos vhosts/certificados
  de produção permanecem iguais aos anteriores.
- `nginx -t` e dry-run de renovação **restrito a stage** passam.

Conferir a preservação de produção sem imprimir nenhum conteúdo de arquivo:

```bash
sudo sha256sum -c "$STAGE_ALIAS_BACKUP/prod.before.sha256"
```

Rollback de DNS: remover apenas o CNAME novo. Considerar os caches positivos
de TTL 300; não remover os registros stage/app.stage. Se o certificado novo
estiver válido e apenas a propagação estiver pendente, não restaurar o antigo
por esse motivo.

Se a intervenção TLS/configuração falhar e exigir restauração, usar o caminho
real do backup registrado, sem sobrescrever a variável com um caminho inventado:

```bash
sudo tar -C / -xzf "$STAGE_ALIAS_BACKUP/stage-tls.tar.gz"
sudo -n /usr/sbin/nginx -t && sudo -n /bin/systemctl reload nginx
```

O arquivo contém somente a linhagem e o vhost de stage. A restauração recupera
links e configuração anteriores; arquivos novos não referenciados podem
permanecer no archive, sem exclusão destrutiva. Se `nginx -t` falhar, **não
recarregar**: preservar o processo ativo e diagnosticar a configuração.
Não restaurar uma configuração Nginx global, certificados de produção ou dados
da aplicação. O listener Nginx é compartilhado: validar a sintaxe antes de
cada reload é obrigatório, mesmo sem editar produção.

## Registro da execução futura

Esta seção permanece pendente: alternativa escolhida, horário, caminho seguro
do backup, IDs/nome dos registros DNS alterados (sem credenciais), resultados
DNS/TLS/HTTP, SANs, validade, renovação e comparação dos hashes de produção.
Atualizar somente após observação real; a preparação não comprova remediação.
