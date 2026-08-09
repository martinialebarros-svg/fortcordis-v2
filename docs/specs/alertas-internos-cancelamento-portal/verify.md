# Verify - alertas-internos-cancelamento-portal

Data: 2026-08-08
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_cancelamento_cria_alerta_interno_explicito` (test_portal_clinica_agendamentos.py) | ok |
| CA-002 | aceitacao | `test_nao_cancela_agendamento_de_outra_clinica` / `test_nao_cancela_agendamento_ja_realizado` (mesma suite), agora com `assertEqual(db.query(AlertaInterno).count(), 0)` | ok |
| CA-003 | aceitacao | `test_criar_e_listar_apenas_nao_lidos_por_padrao`, `test_marcar_lido_remove_da_lista_de_nao_lidos` (test_alertas_internos.py) | ok |
| CA-004 | aceitacao | `test_marcar_lido_remove_da_lista_de_nao_lidos` | ok |
| CA-005 | aceitacao | `test_marcar_todos_lidos` | ok |
| CA-006 | aceitacao | `test_marcar_lido_de_alerta_inexistente_retorna_404` | ok |
| NFR-001 | nao funcional | Leitura de codigo: `criar_alerta_interno(db, ...)` chamado antes de `db.commit()` em `cancelar_agendamento_clinica_portal`, sem commit intermediario — mesma transacao. | ok |
| NFR-002 | nao funcional | `listar_alertas_internos` nao filtra por papel, so por `Depends(get_current_user)`. | ok |
| NFR-003 | nao funcional | `AlertasInternosBell.tsx`: todos os `catch` de rede sao silenciosos (comentado no codigo). Sem teste de componente (nao ha suite de componente neste repo para telas internas). | parcial |

## 2) Testes automatizados executados

```bash
# backend (a partir da raiz do repo, mesma invocacao do CI em deploy-stage.yml)
DATABASE_URL=sqlite:///./fortcordis-ci.db \
SECRET_KEY=deploy-stage-quality-gate-secret-key-1234567890 \
python -m unittest discover -s backend/tests -p "test_*.py"

# migracoes (ciclo completo, incluindo a nova 20260808_65)
python -m unittest tests.test_migration_ci_cycle -v

# frontend
npx tsc --noEmit -p tsconfig.json
npx eslint components/layout/AlertasInternosBell.tsx app/layout-dashboard.tsx
```

Resumo dos resultados:
- Backend: suite completa — **690 testes, 0 falhas, 1 skip** (inclui os 4 testes novos de
  `test_alertas_internos.py` e o teste novo de integracao em
  `test_portal_clinica_agendamentos.py`).
- Migracoes: `test_migration_ci_cycle` (ciclo up/down/up completo com as 65 migracoes, incluindo a
  nova) passou.
- Frontend: `tsc --noEmit` sem erros; `eslint` sem erros/avisos.
- Boot do `next dev` local: `/dashboard`, `/agenda`, `/financeiro` (paginas internas, usam
  `DashboardLayout`) e `/clinica-parceira` (portal externo, nao usa esse layout) todos retornaram
  200 com compilacao limpa.

## 3) Testes manuais

- **Nao executados neste ambiente** — o sino e um componente `ssr:false` (so renderiza no
  navegador, apos autenticacao real); nao ha backend/DB/sessao interna disponiveis neste sandbox
  para logar e ver a tela.
- Pendente para quando o usuario liberar em stage:
  1. Logar como usuario interno, cancelar um agendamento pelo portal (em outra aba/sessao como
     clinica) e confirmar que o sino mostra "1" em ate 45s (ou imediatamente ao recarregar a
     pagina).
  2. Abrir o dropdown, confirmar o texto do alerta (clinica, agendamento, data/servico quando
     disponiveis).
  3. Marcar como lido e confirmar que desaparece da lista e a contagem cai.
  4. Repetir gerando 2+ alertas e usar "Marcar tudo como lido".
  5. Confirmar visualmente, em mobile e desktop, que o sino nao fica escondido atras de outro
     elemento (posicionamento fixed no canto superior direito).
  6. Confirmar que o sino NAO aparece no portal da clinica parceira.

## 4) Regressao e riscos residuais

- Risco residual 1: posicionamento do sino (`fixed`) nao foi validado visualmente em viewport
  mobile real — risco de sobreposicao com o cabecalho mobile existente
  (`fc-mobile-header`) em telas muito estreitas. Verificar no item 5 do roteiro manual.
- Risco residual 2: sem teste automatizado de componente para `AlertasInternosBell.tsx` (mesma
  limitacao registrada nas entregas anteriores desta sessao para telas React).
- Risco residual 3: alertas nao lidos acumulam indefinidamente se a equipe nao marcar como lido
  (sem expiracao automatica) — aceitavel para o volume esperado (cancelamentos pelo portal nao
  devem ser numerosos), mas vale monitorar em produção.
- Nenhuma regressao detectada nas suites existentes (backend completo + migracoes + frontend).

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado ainda — pendente do QA manual do usuario em stage (essencial aqui: e a unica
      forma de validar visualmente o sino).
