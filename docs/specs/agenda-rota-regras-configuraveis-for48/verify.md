# Verify - agenda-rota-regras-configuraveis-for48

Data: 2026-05-17  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `PUT/GET /configuracoes` e `GET /agenda/configuracao` com `agenda_rota_regras` | ok |
| CA-002 | aceitacao | validação em `agenda.py` com `CONFLITO_DESLOCAMENTO`, `desvio_insercao_min` e limite de trecho vizinho | ok |
| CA-003 | aceitacao | seção "Regras de rota e oferta" em `frontend/app/configuracoes/page.tsx`, incluindo o campo `max_neighbor_travel_min` como "Deslocamento maximo entre atendimentos" | ok |
| CA-004 | aceitacao | clique em slot fechado abre excecao somente para `admin` em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-005 | aceitacao | modo Lista exibe alertas de "Agenda fechada" e "Janela especial" por data no periodo filtrado | ok |
| CA-006 | aceitacao | botoes de rota para Google Maps adicionados em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-007 | aceitacao | Agenda Lista permite receber pagamento da OS vinculada com modal de forma de pagamento em `frontend/app/agenda/page.tsx` | ok |
| CA-008 | aceitacao | regras de status/pagamento compartilhadas via `frontend/lib/agenda-shared-actions.ts` aplicadas em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-009 | aceitacao | alternancia entre Lista e FullCalendar preserva contexto de data/status via query string em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-010 | aceitacao | build do frontend conclui sem erro de prerender em `/agenda` apos ajuste da leitura de query string nas telas de Agenda | ok |
| CA-011 | aceitacao | mensagem de proximidade detalha deslocamento com nomes das clinicas (anterior/destino/posterior), dia da semana e indicacao de ausencia de vizinho quando aplicavel em `backend/app/api/v1/endpoints/agenda.py` e `frontend/app/agenda/NovoAgendamentoModal.tsx` | ok |
| CA-012 | aceitacao | `test_sugestoes_horario_exigem_margem_segura_entre_vizinhos` e `test_validacao_agendamento_exige_margem_segura_de_deslocamento` cobrem folga menor que deslocamento + margem | ok |
| CA-013 | aceitacao | `test_validacao_agendamento_bloqueia_trecho_vizinho_acima_do_limite_mesmo_com_folga` e `test_sugestoes_horario_bloqueiam_trecho_vizinho_acima_do_limite` cobrem trecho acima de `max_neighbor_travel_min` | ok |
| NFR-001 | nao funcional | cache de deslocamento por request mantido | ok |
| NFR-002 | nao funcional | sem novos endpoints publicos; usa permissao de configuracoes existente | ok |
| NFR-004 | nao funcional | perfis nao-admin sem acao de abertura rapida de excecao em slot fechado | ok |
| NFR-005 | nao funcional | secretaria visualiza fechamento/horario especial sem depender de clique em slot | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend (sanidade de sintaxe)
python3 -m py_compile backend/app/api/v1/endpoints/agenda.py \
  backend/app/api/v1/endpoints/configuracoes.py \
  backend/app/core/agenda_route_rules.py \
  backend/app/models/configuracao.py

# frontend
cd frontend && npx eslint app/configuracoes/page.tsx lib/agenda-route-rules.ts
cd frontend && npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx lib/waze.ts lib/agenda-shared-actions.ts
cd frontend && npx tsc --noEmit
cd frontend && npm run build

# backend (regras de margem segura em sugestao/salvamento)
cd backend && ./venv/bin/python -m pytest -q tests/test_agenda_sugestao_janela_operacional.py
```

Resumo dos resultados:
- Backend: ok (py_compile).
- Backend agenda: ok (`28 passed` em `test_agenda_sugestao_janela_operacional.py`).
- Frontend: ok (eslint + tsc + build), incluindo validacao das duas telas de agenda e helper de navegacao.
- Atualizacao 2026-06-12: ok (`npx eslint app/configuracoes/page.tsx lib/agenda-route-rules.ts` e `npx tsc --noEmit`) apos expor `max_neighbor_travel_min` na UI.
- Observacao: os avisos de deprecacao de Pydantic/SQLAlchemy ja existiam no projeto.

## 3) Testes manuais

- Cenario 1: editar e salvar regras de rota em Configuracoes.
- Cenario 2: validar sugestao de proximidade para clinica distante/baixa frequencia.
- Cenario 3: validar bloqueio de insercao com desvio acima do limite.
- Cenario 4: em slot fechado, validar abertura de excecao por `admin` com confirmacao e bloqueio para nao-admin.
- Cenario 5: no modo Lista, aplicar periodo e validar exibicao de alertas de agenda fechada/janela especial.
- Cenario 6: validar abertura de rota por Waze e Google Maps nas acoes da agenda e no drawer do FullCalendar.
- Cenario 7: no modo Lista, validar botao "Receber" para OS pendente e transicao para "Pago" apos confirmacao.
- Cenario 8: em Agenda Lista, clicar "Ver FullCalendar" e confirmar abertura com mesma data/filtro de status; em FullCalendar, clicar "Ver Agenda Lista" e confirmar retorno com mesma data no modo Lista.
- Cenario 9: abrir sugestao de proximidade com vizinho anterior e/ou posterior e confirmar mensagem explicita com nomes das clinicas, total de deslocamento e aviso quando nao ha vizinho anterior/posterior.
- Cenario 10: tentar salvar e sugerir horario com trecho vizinho acima de `max_neighbor_travel_min` e confirmar bloqueio mesmo com folga suficiente.

## 4) Regressao e riscos residuais

- Risco residual 1: calibracao operacional dos limiares pode exigir ajuste fino em producao.
- Risco residual 2: clinicas sem coordenada validada reduzem potencial de roteirizacao.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
