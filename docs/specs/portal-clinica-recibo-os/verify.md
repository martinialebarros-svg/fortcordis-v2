# Verify - portal-clinica-recibo-os

Data: 2026-08-08
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_baixa_recibo_de_os_paga_da_propria_clinica` (backend/tests/test_portal_clinica_recibo.py) — valida `StreamingResponse`, `media_type`, nome do arquivo | ok |
| CA-002 | aceitacao | `test_nao_baixa_recibo_de_os_de_outra_clinica` | ok |
| CA-003 | aceitacao | `test_nao_baixa_recibo_de_os_pendente` | ok |
| CA-004 | nao regressao | Suite completa do backend (685 testes) apos a refatoracao de `ordens_servico.py`, sem falhas; boot do `next dev` em `/financeiro` sem erro. Sem teste automatizado dedicado ao PDF gerado pela rota interna (nao existia antes da refatoracao tambem). | parcial |

## 2) Testes automatizados executados

```bash
DATABASE_URL=sqlite:///./fortcordis-ci.db \
SECRET_KEY=deploy-stage-quality-gate-secret-key-1234567890 \
python -m unittest discover -s backend/tests -p "test_*.py"

cd frontend
npx tsc --noEmit -p tsconfig.json
npx eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts
```

Resultado: backend 685/685 (1 skip pre-existente); frontend sem erros de tipo/lint. Boot do
`next dev` local confirmou `GET /clinica-parceira` e `GET /financeiro` retornando 200 sem
marcadores de erro.

## 3) Testes manuais

- **Nao executados neste ambiente.** Pendente para quando o usuario liberar em stage:
  1. Na tela interna de Financeiro, gerar um recibo (unitario e agrupado) de uma OS conhecida e
     comparar visualmente com o PDF gerado antes desta mudanca (deve ser identico).
  2. No portal, logar como uma clinica com OS paga e clicar "Recibo" — conferir que o PDF abre e
     tem os dados corretos (numero da OS, valor, data, servico, paciente).
  3. Conferir visualmente que o recibo do portal nao tem assinatura/CRMV de um profissional
     especifico (emitente = nome da empresa).

## 4) Regressao e riscos residuais

- Risco residual: a refatoracao em `ordens_servico.py` toca um arquivo financeiro interno
  importante; mitigado por ser extracao pura (nao ha nenhuma linha de logica de negocio alterada,
  so movida) e pela suite completa continuar verde — mas vale conferir visualmente o PDF interno
  uma vez em stage (item 1 acima) antes de aprovar.
- Nenhuma paginacao/agrupamento no portal (um recibo por vez) — aceitavel para o pedido original.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado ainda — pendente do QA manual do usuario em stage.
