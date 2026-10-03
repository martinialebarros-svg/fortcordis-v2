# Intent - frontend-real-user-performance

## Problema

A observabilidade atual mede a latencia da API, mas nao responde quanto tempo o
usuario espera ate uma pagina autenticada aparecer e terminar sua carga
principal. Uma API rapida pode coexistir com uma tela lenta, cancelada ou presa
em carregamento.

## Objetivo

Criar o PERF-23 para medir, no navegador real, o tempo percebido das rotas
prioritarias e expor apenas agregados administrativos por rota e release.

## Limites de privacidade e seguranca

- Nao persistir URL completa, query string, identificador de usuario, paciente,
  tutor, clinica, dado financeiro, conteudo clinico ou payload de resposta.
- Aceitar somente rotas agrupadas em uma lista fechada.
- A coleta deve ser assincrona, descartavel e nunca bloquear a pagina.
- A consulta agregada permanece restrita a administradores.
