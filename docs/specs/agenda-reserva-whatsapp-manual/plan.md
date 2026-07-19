# Plan - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: ready-for-stage

## 1) Sequencia

1. [x] Adicionar lista de WhatsApps a clinica e migrar o telefone legado.
2. [x] Atualizar cadastro/edicao com campos dinamicos.
3. [x] Generalizar a mensagem manual para reserva e agendamento.
4. [x] Persistir prazo e liberar reservas vencidas.
5. [x] Adicionar regressao de contatos, migracao e expiracao.
6. [x] Executar suite completa e build; guardrail SDD sera executado sobre o commit final.
7. [ ] Publicar e validar em stage.

## 2) Plano de testes

- Backend focado: criacao/edicao de clinica, fallback legado, migracao SQLite, reserva sem paciente e slot liberado apos expiracao.
- Backend completo: `unittest discover`.
- Frontend: ESLint, TypeScript e build Next.js.
- Guardrail: `check_sdd_guardrail.py` contra `origin/stage`.
- Stage: workflows finais, versoes de migracao, commit do VPS e smokes HTTP.

## 3) Riscos e rollback

- Risco: JSON de contatos divergir entre SQLite e PostgreSQL. Mitigacao: migracao especifica por dialeto e teste de ciclo.
- Risco: reserva vencida continuar presa na constraint. Mitigacao: expirar no mesmo fluxo transacional antes da validacao/escrita.
- Risco: mensagem ser aberta no numero errado. Mitigacao: seletor explicito quando houver mais de um destino.
- Rollback: reverter codigo; manter colunas novas e seus dados para evitar perda.

## 4) Dependencias

- Navegador precisa permitir abertura do WhatsApp por clique.
- Conta Meta pode continuar em analise porque o envio e manual.
