# Verify - clinic-fiscal-names

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `/clinicas/novo` contem `Nome Fantasia *`, `Razao Social` e envia `razao_social` no payload. | ok |
| CA-002 | aceitacao | `/clinicas/[id]` carrega `data.razao_social`, exibe o campo e salva `razao_social`. | ok |
| CA-003 | aceitacao | `NovoAgendamentoModal` contem `clinica_nova_razao_social` e envia `razao_social` no cadastro rapido. | ok |
| CA-004 | aceitacao | `/clinicas` filtra por `razao_social` e exibe o valor quando preenchido. | ok |
| NFR-001 | compatibilidade | Nenhuma alteracao de API/banco; `nome` continua sendo o campo obrigatorio. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend
npx eslint app/clinicas/page.tsx app/clinicas/novo/page.tsx 'app/clinicas/[id]/page.tsx' app/agenda/NovoAgendamentoModal.tsx --max-warnings=0
npm run build

cd ../backend
venv/bin/python -m unittest tests.test_fiscal_exportacao_consolidada
```

Resumo dos resultados:
- Frontend: ESLint direcionado passou; build Next.js passou.
- Backend: 3 testes fiscais passaram.
- Observacao: `npm run lint` global falhou em `frontend/public/sw.js` por regra preexistente `@next/next/no-assign-module-variable`, fora do escopo desta entrega.

## 3) Testes manuais

- Cenario 1: criar clinica em `/clinicas/novo` com Nome Fantasia e Razao Social.
- Cenario 2: editar clinica existente e confirmar persistencia de Razao Social.
- Cenario 3: criar clinica pelo cadastro rapido da agenda e confirmar envio de `razao_social`.

## 4) Regressao e riscos residuais

- Risco residual 1: validacao visual final depende do deploy concluir em producao.
- Risco residual 2: clinicas antigas permanecem sem razao social ate atualizacao cadastral.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para producao.
