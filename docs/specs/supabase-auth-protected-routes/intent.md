# Intencao

Usar o Supabase Auth do projeto fortcordis-prod para autenticar a equipe interna,
preservando usuarios, papeis, matriz de permissoes e os contratos FastAPI existentes.
Bloquear paginas internas no servidor antes da renderizacao e renovar a sessao
sem expor refresh tokens ao JavaScript.

O pedido inicial autorizou a implementacao. Em seguida, o usuario autorizou
homologacao em stage com contas sinteticas e exigiu relatorio antes de qualquer
mudanca em producao. Importacao das contas reais e ativacao em producao continuam
fora desta autorizacao.
