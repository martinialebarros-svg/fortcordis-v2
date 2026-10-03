# Plan - frontend-real-user-performance

1. Criar uma tabela aditiva e idempotente para amostras anonimas de desempenho
   do frontend, com retencao limitada e indices por data, rota e release.
2. Expor uma escrita autenticada que valida uma lista fechada de rotas e atribui
   o release no servidor.
3. Medir navegacao inicial e navegacao interna no shell persistente, incluindo
   primeiro paint da rota, prontidao do conteudo, timeout e cancelamento.
4. Sinalizar prontidao nas paginas Dashboard, Atendimento, Laudos e
   Configuracoes sem alterar seus contratos de carga.
5. Expor p50/p95/p99 agregados no painel administrativo de Desempenho.
6. Cobrir validacao, privacidade, agregacao, retencao, timeout, cancelamento e
   normalizacao de rota com testes locais.
