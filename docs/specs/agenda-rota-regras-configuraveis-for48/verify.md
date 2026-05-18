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
| NFR-001 | nao funcional | cache de deslocamento por request mantido | ok |
| NFR-002 | nao funcional | sem novos endpoints publicos; usa permissao de configuracoes existente | ok |

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
cd frontend && npx tsc --noEmit
```

Resumo dos resultados:
- Backend: ok (py_compile).
- Frontend: ok (eslint + tsc).
- Observacao: `pytest` nao disponivel no ambiente local desta execucao.

## 3) Testes manuais

- Cenario 1: editar e salvar regras de rota em Configuracoes.
- Cenario 2: validar sugestao de proximidade para clinica distante/baixa frequencia.
- Cenario 3: validar bloqueio de insercao com desvio acima do limite.

## 4) Regressao e riscos residuais

- Risco residual 1: calibracao operacional dos limiares pode exigir ajuste fino em producao.
- Risco residual 2: clinicas sem coordenada validada reduzem potencial de roteirizacao.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
