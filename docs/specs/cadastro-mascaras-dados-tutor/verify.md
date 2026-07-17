# Verify - cadastro-mascaras-dados-tutor

Data: 2026-07-16
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | Formatacao e normalizacao de telefone/WhatsApp nos cadastros afetados | ok |
| CA-002 | Formatacao e normalizacao de CPF nas tres telas de paciente/tutor | ok |
| CA-003 | Formatacao e normalizacao de CEP nos cadastros afetados | ok |
| CA-004 | Formatadores removem caracteres nao numericos antes de aplicar a mascara | ok |
| CA-005 | Payloads usam `normalizarTelefone`, `normalizarCpf` e `normalizarCep` | ok |
| CA-006 | Cadastro de clinica usa `formatarCnpjVisual` e `normalizarCnpj` | ok |
| CA-007 | `npm run lint`, `npm run build` e `git diff --check` | ok |

## 2) Testes automatizados

```bash
cd frontend
npm run lint
npx tsc --noEmit --pretty false
npm run build

git diff --check
```

Resultado:

- `npm run lint`: passou sem warnings.
- `npx tsc --noEmit --pretty false`: passou sem erros de tipos.
- `npm run build`: passou com 33 paginas geradas e verificacao de tipos concluida.
- `git diff --check`: passou sem erros de espacos ou conflitos.

## 3) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao, condicionado ao sucesso dos gates de stage.
