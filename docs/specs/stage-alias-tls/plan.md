# Plan — Alias HTTPS de stage

1. Confirmar DNS autoritativo, SANs, vhost, rotas, renovação e permissões.
2. Implementar reparo restrito e workflow manual com credenciais existentes;
   revisar segurança, testar guards/rollback e validar sintaxe.
3. Incorporar pelo PR protegido para stage; aguardar os checks necessários.
4. Publicar o CNAME no painel autenticado e confirmar resolução autoritativa.
5. Executar o reparo TLS serializado com deploy; acompanhar resultado terminal.
6. Conferir DNS, TLS, rotas, renovação e hashes de produção; registrar evidências.

Nenhuma promoção adicional de código da aplicação para produção é necessária.
