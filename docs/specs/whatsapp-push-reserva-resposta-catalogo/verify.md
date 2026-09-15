# Verify - whatsapp-push-reserva-resposta-catalogo

## Matriz de rastreabilidade

| ID | Tipo | Evidência | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | leitura de código: `"whatsapp_reserva_resposta"` presente em `AGENDA_PUSH_ACTIONS_ORDER`, portanto em `PUSH_ACTIONS_SET`; `_get_target_subscriptions` não filtra mais essa ação para fora | ok |
| CA-002 | aceitação | leitura de código: `_build_agenda_title`/`_build_agenda_body` cobrem os 7 resultados de `process_button_response`, com fallback textual (não mais "Agenda atualizada #N") para resultado desconhecido | ok |
| CA-003 | aceitação | leitura de código: `TIPOS_PUSH_AGENDA_OPCOES` inclui o novo item; painel e `alternarTipoPushAgenda` iteram sobre o array sem mudança adicional | ok |
| NFR-001 | não funcional | catálogo alterado só por adição no fim da tupla; nenhum outro valor removido/reordenado | ok |
| CB-002 | caso de borda | comportamento idêntico ao de qualquer tipo novo adicionado ao catálogo (preferências antigas não ganham o tipo automaticamente) — aceito como esperado | ok |

## Testes automatizados executados

Comando:

```bash
venv/bin/python -m unittest discover -s tests -p "test_*.py"
```

Resultado: `Ran 805 tests in 37.482s` — `OK`. Nenhum teste cobre
diretamente `_build_agenda_title`/`_build_agenda_body`/catálogo de push
(funções privadas, sem teste dedicado antes desta mudança); a suíte
serve como regressão geral do backend, não como cobertura direta deste
fix.

## Testes manuais

- Pendente: responder a um botão de confirmação de reserva via WhatsApp
  em stage e confirmar que uma assinatura com a preferência habilitada
  recebe o push com título/corpo específicos (não o fallback genérico).
  Não executado nesta sessão por não ter ambiente de stage com WhatsApp
  configurado disponível para o agente.

## Regressão e riscos residuais

- Risco residual: o payload de `process_button_response` continua sem
  nome de paciente/clínica/serviço — o corpo da notificação é genérico
  por resultado (ex: "Reserva confirmada com sucesso pelo cliente via
  WhatsApp. Status atual: Confirmado."), não menciona qual paciente/pet.
  Decisão deliberada de escopo (ver `intent.md` — fora de escopo).
- Risco residual: usuários que já customizaram
  `notificacoes_push_tipos` antes desta mudança não recebem o novo tipo
  até revisitarem Configurações — comportamento esperado, não uma
  regressão.

## Itens fora de escopo entregues

- Nenhum.

## Causa raiz do bloqueio de deploy (2026-08-19)

O PR #60 foi mesclado em `main` (commit `2d5ae222`) só com as mudanças de
código (`backend/app/services/push_notifications.py`,
`frontend/app/configuracoes/page.tsx`), sem spec/verify. O check
`sdd-guardrail` do PR passou de forma espúria: a branch
`claude/recursing-elgamal-5a940f` tinha sido criada a partir de um commit
de `main` bem mais antigo, então o diff de duas pontas
(`base_sha..head_sha`) usado pelo guardrail incluiu, como "alterados",
vários `docs/specs/*/spec.md`+`verify.md` de outras features que já
existiam em `main` mas não na branch — qualificando o guardrail por
acidente. No push direto a `main` depois do merge, o diff correto (tip
anterior de `main` → novo tip) só continha os dois arquivos de código,
sem nenhuma feature SDD qualificada — o workflow "Deploy to VPS" barrou
no job `sdd-guardrail` e o job `deploy` nunca rodou. Esta pasta
(`docs/specs/whatsapp-push-reserva-resposta-catalogo/`) é o fix-forward:
adiciona spec+verify no mesmo diff do próximo push a `main`, sem alterar
nenhum comportamento de aplicação.

## Resultado final - 2026-08-19

- Backend: `unittest discover` — 805 testes, `OK`.
- Frontend: sem novos testes automatizados; mudança é um item estático em
  array de configuração, verificada por leitura de código.
- Deploy: pendente reexecução após este commit de documentação ser
  enviado a `main`.

## Decisão de release

- [x] Aprovado para stage (código já em produção desde o merge do PR #60;
  esta pasta destrava o gate de deploy, não introduz mudança de app).
- [ ] Aprovado para produção (depende do deploy reexecutar com sucesso
  após este commit).
- [ ] Não aprovado.
