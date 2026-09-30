# Verificacao

- [x] SQLite: origem domiciliar aparece na lista; origem de clinica nao aparece.
- [x] Teste unitario: origem nao domiciliar e tutor divergente sao recusados.
- [x] Teste unitario: PDF gerado segue para o numero cadastrado; PDF invalido e recusado antes da rede.
- [x] Teste unitario: token interno invalido e arquivo invalido sao recusados pelo servico WhatsApp.
- [x] Build TypeScript do servico WhatsApp, lint da pagina, testes backend focados e `git diff --check`.
- [x] PostgreSQL temporario: migration, conversa sintetica, janela aberta/fechada, persistencia da mensagem e repeticao idempotente; Meta simulada.
- [x] Teste backend: PDF externo usa os bytes do arquivo original sem renderizar outro PDF.
- [x] Servico WhatsApp simulado: falha definitiva permite repeticao; falha incerta bloqueia repeticao.
- [x] Sobre `origin/stage` de 2026-09-30: suite de laudos do backend com 139 testes; frontend com 453 testes Vitest e 9 testes Node.
- [x] Typecheck, lint da pagina e build completo do frontend; build TypeScript do servico WhatsApp.
- [ ] Guardrail SDD com os SHAs da alteracao publicada.
- [ ] Smoke autenticado em stage com destinatario de teste antes de publicacao. Nenhum envio real foi autorizado ou executado.
