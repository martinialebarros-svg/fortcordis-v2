# Verify - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: verified-for-stage-hotfix

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | campos condicionais no modal com prazo inicial de duas horas | passou |
| CA-002 | aceitacao | validacao de prazo futuro e anterior ao atendimento no submit | passou |
| CA-003 | aceitacao | tela de entrega manual preservada apos criacao nas duas visoes da agenda | passou |
| CA-004 | aceitacao | helper de link `wa.me` com normalizacao e texto codificado | passou |
| CA-005 | aceitacao | acao de clipboard copia o mesmo estado exibido no textarea | passou |
| CA-006 | borda | link de compartilhamento sem numero quando o telefone nao existe | passou |
| CA-007 | aceitacao | prazo e destinatario adicionados a `observacoes` antes do POST | passou |
| CA-008 | regressao | condicionais limitadas a nova criacao com status de reserva | passou |
| CA-009 | regressao | reserva sem paciente persiste `NULL` e respeita `fk_agenda_paciente` | passou |
| NFR-001 | nao funcional | endpoint, payload publico e banco preservados | passou |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend && npx eslint app/agenda/NovoAgendamentoModal.tsx app/agenda/fullcalendar/page.tsx lib/agenda-reserva-manual.ts --max-warnings=0
cd frontend && npm run build
backend/venv/bin/python -m unittest backend/tests/test_agenda_duracao_servico_create.py
backend/venv/bin/python -m unittest discover -s backend/tests -p "test_*.py"
git diff --check
```

Resumo dos resultados:
- ESLint focado: passou sem avisos.
- Build Next.js 15.5.14: passou, incluindo compilacao, lint, tipos e geracao das 33 paginas estaticas.
- Regressao backend de reserva sem paciente: 6 testes passaram no arquivo focado.
- Suite backend completa: 322 testes passaram.
- Lint frontend e `npx tsc --noEmit --pretty false`: passaram sem avisos ou erros.
- Integridade do diff: passou sem whitespace errors.

## 3) Testes manuais

- Cenario 1: reserva para clinica com telefone.
- Cenario 2: reserva para tutor usando WhatsApp/telefone cadastrado.
- Cenario 3: reserva sem telefone abre compartilhamento sem destinatario.
- Cenario 4: prazo invalido bloqueia o salvamento.

Estes cenarios ficam como smoke operacional em stage, pois exigem sessao autenticada, cadastros reais e abertura do WhatsApp no navegador do usuario.

## 4) Regressao e riscos residuais

- Risco residual 1: envio e liberacao do horario continuam dependendo da acao humana.
- Risco residual 2: `wa.me` depende do comportamento do navegador e do WhatsApp instalado/logado.
- Incidente de stage: confirmado que o sentinela legado `paciente_id=0` violava `fk_agenda_paciente`; o hotfix normaliza para `NULL`.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado enquanto verificacoes estiverem pendentes.
