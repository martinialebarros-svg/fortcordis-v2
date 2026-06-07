# Verify - agenda-assistente-nox-readonly

Data: 2026-06-07
Responsavel: Martiniano + Codex
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 | funcional | `GET /api/v1/agenda/assistente/contexto` valida token em header dedicado ou bearer | ok |
| RF-002 | funcional | integracao desabilitada quando `ASSISTENTE_AGENDA_TOKEN` ausente/curto | ok |
| RF-002A | funcional | `Settings` aceita `ASSISTENTE_AGENDA_TOKEN` e `ASSISTENTE_AGENDA_MAX_WINDOW_DAYS` vindos do env | ok |
| RF-003 | funcional | parametros de periodo/filtro implementados na rota | ok |
| RF-004 | funcional | limite por `ASSISTENTE_AGENDA_MAX_WINDOW_DAYS` e teto duro de 31 dias | ok |
| RF-005 | funcional | serializador read-only retorna somente ocupacao operacional | ok |
| RF-006 | funcional | `incluir_paciente=true` retorna apenas primeiro nome | ok |
| RF-007 | funcional | resposta inclui catalogos minimos e regras de agenda/rota | ok |
| RF-008 | funcional | contrato explicita modo read-only e acoes bloqueadas | ok |
| RF-009 | funcional | bloco `operacional` retorna fila/status, vagas livres, conflitos, gargalos e pendencias | ok |
| RF-010 | funcional | teste garante que `operacional` nao exponha telefone, tutor ou observacoes | ok |
| NFR-001 | privacidade | testes garantem ausencia de telefone, tutor e observacoes no item | ok |
| NFR-002 | seguranca | token comparado com `secrets.compare_digest` | ok |
| NFR-005 | decisao assistida | `operacional.orientacao_nox` explicita que vagas nao sao confirmacao automatica | ok |

## 2) Testes automatizados

Comando recomendado:

```bash
cd backend && ./venv/bin/python -m pytest -q tests/test_agenda_assistente_contexto_readonly.py
```

Validacoes cobertas:

- token ausente/invalido retorna 403;
- resposta autorizada nao inclui telefone, tutor, observacoes nem paciente completo;
- primeiro nome de paciente so aparece quando solicitado;
- bloco operacional inclui vagas livres, conflitos e pendencias sem dados sensiveis;
- janela acima do limite retorna 422.

## 3) Smoke operacional recomendado

1. Gerar token forte no servidor.
2. Configurar `ASSISTENTE_AGENDA_TOKEN` e reiniciar backend.
3. Consultar uma janela curta:

```bash
curl -sS "$FORTCORDIS_API_URL/api/v1/agenda/assistente/contexto?data_inicio=2026-06-07&data_fim=2026-06-14" \
  -H "X-Assistente-Agenda-Token: $ASSISTENTE_AGENDA_TOKEN"
```

4. Confirmar que o payload tem agenda, operacional, regras, clinicas/servicos ativos e nao tem telefone/tutor/observacoes.

## 4) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
