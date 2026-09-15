# Verify - pacientes-busca-carteira-completa

Data: 2026-09-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitação | `test_busca_remota_retorna_paciente_ativo_e_preserva_total_da_carteira` e teste de interface com carteira de 1.299 itens | ok |
| CA-002 | aceitação | `PacientesPage` envia `/pacientes?limit=100&skip=0&search=rex` após a digitação | ok |
| CA-003 | aceitação | `PacientesPage` solicita `/pacientes?limit=100&skip=100` ao abrir a segunda página | ok |
| CA-004 | aceitação | teste de API diferencia `total_ativos` de `total`; teste de interface exibe ambos | ok |
| CA-005 | aceitação | teste `permite tentar novamente após uma falha de carregamento` | ok |

## 2) Testes automatizados executados

Comandos planejados:

```bash
cd backend
venv/bin/python -m unittest tests/test_pacientes_listagem.py -v

cd frontend
npx vitest run app/pacientes/page.test.tsx
npm run lint
npx tsc --noEmit
npm run build
```

Resumo dos resultados:

- Backend: 2 testes passaram.
- Frontend: 3 testes focados passaram; lint, TypeScript e build passaram.

## 3) Testes manuais

- Busca por um paciente após a primeira página: coberta pelo teste automatizado com 1.299 registros; smoke autenticado pendente de publicação solicitada.
- Navegação entre páginas: coberta por teste automatizado; smoke autenticado pendente de publicação solicitada.
- Falha de API e tentativa novamente: coberta por teste automatizado.

## 4) Regressao e riscos residuais

- Pacientes desativados permanecem ocultos por contrato; esta correção não os reativa.
- A validação visual autenticada deve ocorrer em stage ou produção após publicação solicitada.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage após solicitação explícita de publicação.
- [ ] Aprovado para producao após solicitação explícita de publicação.
- [x] Aprovado para revisão local.
