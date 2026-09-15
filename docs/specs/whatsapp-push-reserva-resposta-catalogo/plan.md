# Plan - whatsapp-push-reserva-resposta-catalogo

## Sequência de fases

- Fase 1 (backend): cadastrar a ação no catálogo e construir
  título/corpo dedicados.
- Fase 2 (frontend): expor a preferência em Configurações.
- Fase 3 (SDD/documentação): registrar spec+verify (este ciclo, feito
  fora de ordem — código já estava em produção quando o gate SDD barrou o
  deploy).

## Tarefas por fase

### Fase 1

- [x] Adicionar `"whatsapp_reserva_resposta"` a `AGENDA_PUSH_ACTIONS_ORDER`
  (`backend/app/services/push_notifications.py`).
- [x] `_WHATSAPP_RESERVA_RESPOSTA_TITULOS`/`_CORPOS` + branch em
  `_build_agenda_title`/`_build_agenda_body` para os 7 resultados de
  `process_button_response`.
- Critério de conclusão: `send_agenda_push_notification` gera título/corpo
  não genéricos para essa ação e a assinatura passa no filtro de
  `allowed_actions`.
- Risco: nenhuma migração envolvida; risco é só de cobertura incompleta
  dos resultados possíveis (mitigado com fallback textual genérico).
- Rollback: reverter o commit (aditivo, sem estado persistido a limpar).

### Fase 2

- [x] Nova opção em `TIPOS_PUSH_AGENDA_OPCOES`
  (`frontend/app/configuracoes/page.tsx`).
- Critério de conclusão: opção aparece no painel de Configurações e o
  toggle funciona igual aos demais tipos.
- Risco: nenhum — painel já itera sobre o array.
- Rollback: remover o item do array.

### Fase 3

- [x] Criar `docs/specs/whatsapp-push-reserva-resposta-catalogo/` com
  `intent.md`, `spec.md`, `plan.md`, `verify.md` para satisfazer o gate
  `scripts/ci/check_sdd_guardrail.py` no push direto a `main` (o guardrail
  bloqueou o deploy do commit `2d5ae222` por falta de spec+verify no
  mesmo diff).
- Critério de conclusão: `check_sdd_guardrail.py` passa no próximo push a
  `main` e o workflow "Deploy to VPS" reexecuta com sucesso.
- Risco: nenhum — só documentação, sem mudança de comportamento.
- Rollback: não aplicável (fix-forward de processo).

## Plano de testes

- Testes unitários: suíte completa do backend
  (`python -m unittest discover -s tests -p "test_*.py"`), 805 testes.
- Testes de integração: nenhum endpoint novo — cobertura via testes
  existentes que exercitam `send_agenda_push_notification`/
  `normalize_agenda_push_actions`.
- Testes manuais: pendente verificação em stage (responder a um botão de
  confirmação de WhatsApp de teste e confirmar que o push chega).

## Dependências e bloqueios

- Nenhuma dependência externa. Bloqueio identificado: `sdd-guardrail`
  exige spec.md/verify.md no mesmo diff de qualquer mudança de código em
  `backend/`, `frontend/` ou `scripts/` — esta fase 3 existe para
  destravar o deploy que já estava mesclado em `main` sem essa
  documentação.

## Checklist para iniciar execução

- [x] `intent.md` e `spec.md` escritos (fix-forward, sem aprovação prévia
  formal — mudança já estava em produção quando o gate foi descoberto).
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: suíte local do backend.
