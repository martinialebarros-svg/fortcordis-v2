# Plan - whatsapp-bot-piloto-por-clinica

Data: 2026-08-24
Responsavel: Martiniano + Claude
Status: Fases 1-3 entregues

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): tabela `whatsapp_bot_clinica_estado` e coluna
  `configuracoes.whatsapp_bot_participacao`.
- Fase 2 (backend): resolucao de modo com os tres niveis, portao em
  `gerar_resposta`, endpoints de leitura e escrita.
- Fase 3 (frontend): secao de participacao no painel do bot.
- Fase 4 (observabilidade): metrica por clinica.

## 2) Tarefas por fase

### Fase 1 - schema

- [x] P1.1 migracao versionada e idempotente criando
      `whatsapp_bot_clinica_estado` (`clinica_id` unico, FK cascade, `modo`,
      `habilitado_por_id`, `observacao`, timestamps) e a coluna
      `configuracoes.whatsapp_bot_participacao` com default `todos`.
- [x] P1.2 modelo SQLAlchemy e teste de migracao idempotente (aplicar duas
      vezes; no-op sem `configuracoes`).
- Criterio de conclusao: migracao aplica em sqlite novo e em banco existente
  sem alterar comportamento (CA-P07, NFR-P01). **Cumprido em 2026-08-24**:
  `setup_database.py` num sqlite novo criou tabela e coluna, e a suite completa
  passou 1044/1044 sem alterar expectativa existente.
- Risco: baixo, aditivo.
- Rollback: a coluna nasce `todos` e a tabela vazia — basta nao usar.

### Fase 2 - backend

- [x] P2.1 `resolve_conversation_mode` ganha o nivel de clinica e a postura,
      preservando a precedencia da RF-P03. Assinatura passa a aceitar
      `clinica_id` opcional; sem ele, comportamento atual.
- [x] P2.2 portao em `gerar_resposta` logo apos `_escopo_da_persona`, antes de
      tools e provider, gravando `fora_do_piloto` ou `clinica_desabilitada`
      (RF-P04, RF-P05).
- [x] P2.3 `GET /whatsapp/bot/clinicas` e
      `PUT /whatsapp/bot/clinicas/{clinica_id}`.
- [x] P2.4 `whatsapp_bot_participacao` na allowlist de `PUT /configuracoes`,
      admin-only, com validacao de valor.
- [x] P2.5 testes: CA-P01 a CA-P06, CA-P08 e CA-P09, com provider fake que
      **falha se chamado** nos caminhos barrados.
- Criterio de conclusao: com a postura em `todos` a suite inteira passa sem
  alteracao de expectativa — a feature e invisivel ate ser ligada.
  **Cumprido em 2026-08-24**: 1063/1063, nenhuma expectativa existente alterada.
- Risco: medio. Mexe na resolucao de modo, que todo job atravessa.
- Rollback: `whatsapp_bot_participacao=todos` restaura o comportamento atual
  sem deploy.

### Fase 3 - frontend

- [x] P3.1 secao "Participacao no piloto" no painel do bot: seletor da postura
      e lista de clinicas ativas com modo, quem habilitou e quando.
- [x] P3.2 testes da lib de formatacao e `eslint`/`tsc`/`build` limpos.
- Criterio de conclusao: admin habilita e desabilita uma clinica pela tela, sem
  console nem chamada manual de API. **Codigo entregue em 2026-08-24**; a
  confirmacao na tela de stage depende de publicar e de haver clinica ativa
  cadastrada la.
- Risco: baixo, aditivo.
- Rollback: esconder a secao mantem o backend intacto.

### Fase 4 - observabilidade

- [ ] P4.1 `GET /whatsapp/bot/metricas` quebrado tambem por clinica, para o
      retorno do piloto ser atribuivel.
- Criterio de conclusao: da para dizer que a clinica X aceita 80% dos rascunhos
  e a Y descarta metade.
- Risco: baixo, somente leitura.
- Rollback: campo novo ignorado pela UI.

## 3) Dependencias e bloqueios

- Nao depende de nada em aberto no chatbot: e ortogonal as oito guardas
  restantes do envio automatico.
- **Bloqueia o P6.3 no formato atual**: com o piloto, a coleta de 20 rascunhos
  decididos por persona passa a depender do volume das clinicas escolhidas.
  Custo de prazo aceito no `intent.md`.
- Nao exige mudanca no servico Node.

## 4) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [ ] `spec.md` aprovado.
- [x] Pergunta aberta dos tutores respondida (opt-in por conversa).
- [ ] Fases e rollback revisados.
- [ ] Definido se a metrica por clinica entra na Fase 4 ou vira feature propria.
