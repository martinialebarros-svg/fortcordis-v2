# Verify - agenda-rota-regras-configuraveis-for48

Data: 2026-05-17  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `PUT/GET /configuracoes` e `GET /agenda/configuracao` com `agenda_rota_regras` | ok |
| CA-002 | aceitacao | validação em `agenda.py` com `CONFLITO_DESLOCAMENTO` e `desvio_insercao_min` | ok |
| CA-003 | aceitacao | seção "Regras de rota e oferta" em `frontend/app/configuracoes/page.tsx` | ok |
| CA-004 | aceitacao | clique em slot fechado abre excecao somente para `admin` em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-005 | aceitacao | modo Lista exibe alertas de "Agenda fechada" e "Janela especial" por data no periodo filtrado | ok |
| CA-006 | aceitacao | botoes de rota para Google Maps adicionados em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-007 | aceitacao | Agenda Lista permite receber pagamento da OS vinculada com modal de forma de pagamento em `frontend/app/agenda/page.tsx` | ok |
| CA-008 | aceitacao | regras de status/pagamento compartilhadas via `frontend/lib/agenda-shared-actions.ts` aplicadas em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-009 | aceitacao | alternancia entre Lista e FullCalendar preserva contexto de data/status via query string em `frontend/app/agenda/page.tsx` e `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-010 | aceitacao | build do frontend conclui sem erro de prerender em `/agenda` apos ajuste da leitura de query string nas telas de Agenda | ok |
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
```

Resumo dos resultados:
- Backend: ok (py_compile).
- Frontend: ok (eslint + tsc + build), incluindo validacao das duas telas de agenda e helper de navegacao.
- Observacao: `pytest` nao disponivel no ambiente local desta execucao.

## 3) Testes manuais

- Cenario 1: editar e salvar regras de rota em Configuracoes.
- Cenario 2: validar sugestao de proximidade para clinica distante/baixa frequencia.
- Cenario 3: validar bloqueio de insercao com desvio acima do limite.
- Cenario 4: em slot fechado, validar abertura de excecao por `admin` com confirmacao e bloqueio para nao-admin.
- Cenario 5: no modo Lista, aplicar periodo e validar exibicao de alertas de agenda fechada/janela especial.
- Cenario 6: validar abertura de rota por Waze e Google Maps nas acoes da agenda e no drawer do FullCalendar.
- Cenario 7: no modo Lista, validar botao "Receber" para OS pendente e transicao para "Pago" apos confirmacao.
- Cenario 8: em Agenda Lista, clicar "Ver FullCalendar" e confirmar abertura com mesma data/filtro de status; em FullCalendar, clicar "Ver Agenda Lista" e confirmar retorno com mesma data no modo Lista.

## 4) Regressao e riscos residuais

- Risco residual 1: calibracao operacional dos limiares pode exigir ajuste fino em producao.
- Risco residual 2: clinicas sem coordenada validada reduzem potencial de roteirizacao.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
