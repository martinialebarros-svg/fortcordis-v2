# Verificacao

- [x] SQLite: origem domiciliar aparece na lista; origem de clinica nao aparece.
- [x] Teste unitario: origem nao domiciliar e tutor divergente sao recusados.
- [x] Teste unitario: PDF gerado segue para o numero cadastrado; PDF invalido e recusado antes da rede.
- [x] Teste unitario: token interno invalido e arquivo invalido sao recusados pelo servico WhatsApp.
- [x] Build TypeScript do servico WhatsApp, lint da pagina, testes backend focados e `git diff --check`.
- [x] PostgreSQL temporario: migration, conversa sintetica, janela aberta/fechada, persistencia da mensagem e repeticao idempotente; Meta simulada.
- [x] Teste backend: PDF externo usa os bytes do arquivo original sem renderizar outro PDF.
- [x] Servico WhatsApp simulado: falha definitiva permite repeticao; falha incerta bloqueia repeticao.
- [x] Teste backend: somente o codigo explicito de janela fechada aciona o modelo; conflito por envio incerto permanece bloqueado.
- [x] Teste do modelo: PDF, destinatario, `subject_type=laudo`, variaveis tutor/pet e gate desligado validados sem requisicao a Meta.
- [x] PostgreSQL temporario: modelo simulado persiste mensagem, repeticao com a mesma chave retorna o mesmo resultado e envio comum reconhece a chave ja concluida pelo modelo.
- [x] Build do servico WhatsApp, testes locais de documento/laudo, 17 testes backend focados, typecheck/lint e build frontend em 2026-10-01.
- [ ] Modelo `laudo_domiciliar_pdf_tutor` aprovado nas contas Meta de stage e producao. Gate `WHATSAPP_HOME_REPORT_TEMPLATE_ENABLED` permanece desligado ate comprovacao por ambiente.
- [ ] Teste autenticado com destinatario controlado e envio real somente com autorizacao explicita.
- [x] Sobre `origin/stage` de 2026-09-30: suite de laudos do backend com 139 testes; frontend com 453 testes Vitest e 9 testes Node.
- [x] Typecheck, lint da pagina e build completo do frontend; build TypeScript do servico WhatsApp.
- [ ] Guardrail SDD com os SHAs da alteracao publicada.
- [ ] Smoke autenticado em stage com destinatario de teste antes de publicacao. Nenhum envio real foi autorizado ou executado.
