# Verify - portal-clinica-financeiro-os

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_retorna_apenas_pendentes_e_pagas_da_propria_clinica` (backend/tests/test_portal_clinica_financeiro.py) | ok |
| CA-002 | aceitacao | mesmo teste: OS "Cancelado" seedada e verificada como ausente de `pendentes`/`pagas` | ok |
| CA-003 | aceitacao | Leitura de codigo: `summary` calculado via `func.sum`/`func.count` sobre a clinica inteira, independente do `.limit()` das listas; sem teste dedicado ao caso de truncamento (nao ha seed com >50 OS pagas). | parcial |
| CA-004 | aceitacao | `test_clinica_sem_movimentacao_recebe_resumo_zerado` | ok |
| CA-005 | aceitacao | Leitura de codigo: bloco JSX envolvido em `{!isAdminPreview ? (...) : null}`, mesmo padrao do bloco de agendamentos; sem teste de componente. | parcial |
| NFR-001 | nao funcional | `obter_financeiro_clinica_portal` chama `_exigir_sessao_clinica_portal`, mesmo helper testado em `test_sessao_sem_clinica_nao_acessa_financeiro`. | ok |
| NFR-002 | nao funcional | Schemas novos nao incluem forma de pagamento, taxas, desconto, `criado_por_nome`, `observacoes`; endpoint nao importa `Transacao`/`ContaPagar`/`ContaReceber`/`CreditoFinanceiro`. | ok |
| NFR-003 | nao funcional | Filtro explicito `status == "Pendente"` / `status == "Pago"` exclui "Cancelado" por omissao, mesmo efeito de `!= "Cancelado"` usado em `resumo_financeiro_agenda`. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend (a partir da raiz do repo, mesma invocacao do CI em deploy-stage.yml)
DATABASE_URL=sqlite:///./fortcordis-ci.db \
SECRET_KEY=deploy-stage-quality-gate-secret-key-1234567890 \
python -m unittest discover -s backend/tests -p "test_*.py"

# frontend
npx tsc --noEmit -p tsconfig.json
npx eslint components/portal/PortalClinicaWorkspace.tsx lib/portal-api.ts
npm run test
```

Resumo dos resultados:
- Backend: suite completa — **682 testes, 0 falhas, 1 skip** (inclui os 3 testes novos de
  `test_portal_clinica_financeiro.py`, executados isoladamente com `OK` antes da rodada completa).
  Nenhuma regressao nos testes de portal/agenda/financeiro existentes.
- Frontend: `tsc --noEmit` sem erros; `eslint` sem erros/avisos nos arquivos alterados;
  `npm run test` — 3 suites vitest / 22 testes ok; 2 falhas pre-existentes e nao relacionadas
  (mesma causa ja registrada nos specs anteriores desta area).
- Boot do `next dev` local + `GET /clinica-parceira` retornou 200, HTML sem marcadores de erro,
  com os tres blocos novos (agendamentos + financeiro) presentes no bundle compilado.

## 3) Testes manuais

- **Nao executados neste ambiente** (sem backend/DB/autenticacao real disponiveis neste sandbox).
- Pendente para quando o usuario liberar em stage:
  1. Logar no portal como uma clinica com OS pendentes e pagas reais.
  2. Confirmar que os valores batem com o que a equipe financeira interna ve para aquela clinica
     (mesma clinica, mesmo periodo).
  3. Confirmar que uma OS cancelada nao aparece em nenhuma lista nem no resumo.
  4. Confirmar, com uma clinica com muitas OS pagas (>50), que o aviso "Mostrando X de Y" aparece
     e o total do resumo continua correto.
  5. Confirmar visualmente que nenhum dado sensivel (forma de pagamento, taxas, nome de quem
     lancou a OS) aparece na tela.

## 4) Regressao e riscos residuais

- Risco residual 1: nao ha teste automatizado do caso de truncamento da lista de "pagas"
  (>50 registros) nem do aviso "Mostrando X de Y" na UI — coberto so por leitura de codigo.
- Risco residual 2: escolha de quais campos financeiros expor foi definida por mim (ver
  `intent.md` secao 7), sem confirmacao campo a campo do usuario — revisar durante o QA manual em
  stage.
- Risco residual 3: nenhuma paginacao real para "pendentes" (limite fixo de 200, sem aviso de
  truncamento) — considerar se alguma clinica puder acumular mais de 200 OS pendentes
  simultaneas (cenario incomum, mas nao impossivel).
- Nenhuma regressao detectada nas suites existentes (backend completo + frontend).

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado ainda — pendente do QA manual do usuario em stage (fluxo definido por ele:
      stage para teste, depois promove para main).
