# Verify - supabase-public-rls-hardening

Data: 2026-04-29  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `python3 -m py_compile backend/migrations/versions/20260430_32_supabase_public_rls_hardening.py` | ok |
| CA-002 | aceitacao | migracao retorna imediatamente quando `dialect != "postgresql"` | ok |
| CA-003 | aceitacao | migracao executa `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para tabelas `public` | pendente-prod |
| CA-004 | aceitacao | migracao revoga grants de `anon` e `authenticated` | pendente-prod |
| CA-005 | aceitacao | frontend verificado usando `/api/v1`/FastAPI, sem `supabase-js` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
python3 -m py_compile backend/migrations/versions/20260430_32_supabase_public_rls_hardening.py
```

Resumo dos resultados:
- Migracao compila sem erro.

## 3) Testes manuais

- Verificacao de arquitetura no repo:
  - frontend usa `frontend/lib/axios.ts` com `baseURL: '/api/v1'`;
  - `rg` nao encontrou uso de `supabase-js` ou `NEXT_PUBLIC_SUPABASE_*` no frontend.

## 4) Regressao e riscos residuais

- Risco residual 1: alguma integracao externa desconhecida pode depender da Data API.
- Risco residual 2: ainda e recomendado desligar a Data API no painel Supabase se ela nao for usada.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente de acesso/deploy em ambiente Supabase.
