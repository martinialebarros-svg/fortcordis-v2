# Intent — Alias HTTPS de stage

O alias `www.stage.fortcordis.com.br`, já previsto no vhost de stage, não tem
registro DNS nem cobertura no certificado. O usuário autorizou resolver ambos
como complemento da entrega da Agenda. O acesso ao Cloudflare foi confirmado
na sessão existente do usuário.

Objetivo: disponibilizar o alias com HTTPS válido, preservando os nomes atuais
de stage, a renovação automática e os vhosts/certificados de produção. Utilizar
as credenciais administrativas já existentes no pipeline, sem criar novas
credenciais, ampliar sudoers ou pedir segredos pelo chat.
