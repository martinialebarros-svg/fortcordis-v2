# Verify - laudo-ecocardiograma-save-alert

Data: 2026-07-30
Responsavel: Martiniano + Codex
Status: release_candidate

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Funcao pura com ambas as entradas falsas lista as duas pendencias | ok |
| CA-002 | aceitacao | Funcao pura com somente uma entrada falsa menciona apenas o item ausente | ok |
| CA-003 | aceitacao | Funcao pura com ambas as entradas verdadeiras retorna `null` | ok |
| CA-004 | aceitacao | Retornos antes das chamadas `api.post`/`api.put` e troca de aba revisados nas duas telas | ok |
| CA-005 | aceitacao | Caminho posterior ao `window.confirm` preserva o salvamento existente | ok |
| CA-006 | aceitacao | Criacao guarda por `tipoLaudo === "ecocardiograma"` e edicao por `TIPO_LAUDO_ECOCARDIOGRAMA` | ok |
| CA-007 | aceitacao | Mesmo helper importado pelas duas telas | ok |
| NFR-001 | nao funcional | TypeScript, lint direcionado, build de producao e `git diff --check` | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
cd frontend
npx tsc --noEmit
npx eslint app/laudos/novo/page.tsx app/laudos/[id]/editar/page.tsx lib/ecocardiograma-save-alert.ts
npx tsc lib/ecocardiograma-save-alert.ts --outDir <tmp> --module commonjs --target ES2020 --skipLibCheck
node -e '<asserts das quatro combinacoes>' <tmp>/ecocardiograma-save-alert.js
npm run build
cd ..
git diff --check
```

Resumo dos resultados:

- Funcao pura: 4 combinacoes aprovadas.
- TypeScript: passou sem erros.
- ESLint direcionado: passou sem erros ou avisos.
- Build Next.js 15.5.14: passou; 39 paginas geradas e as rotas
  `/laudos/novo` e `/laudos/[id]/editar` compiladas.
- Higiene do diff: `git diff --check` passou.
- Backend: nao aplicavel; sem mudanca.

## 3) Testes manuais

- Cenario 1: sem analise e sem imagem; mensagem conjunta verificada pela funcao
  pura e destino `Qualitativa` revisado no codigo.
- Cenario 2: analise aplicada e sem imagem; mensagem exclusiva verificada e
  destino `Imagens` revisado no codigo.
- Cenario 3: imagem carregada e analise nao aplicada; mensagem exclusiva
  verificada e destino `Qualitativa` revisado no codigo.
- Cenario 4: ambos presentes; retorno `null` verificado.
- Cenario 5: confirmacao positiva; continuidade ate o salvamento revisada no
  codigo.
- Cenario 6: laudo de pressao arterial; guardas de tipo revisadas nas duas telas.

## 4) Regressao e riscos residuais

- Validacao visual autenticada nao foi executada neste ciclo local.
- A entrega foi isolada em worktree limpo baseado no `origin/stage` atual; a
  promocao deve ser interrompida se esse remoto avancar antes do push.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado tecnicamente para integracao em stage.
- [x] Aprovado para producao depois do sucesso integral de stage.
- [ ] Nao aprovado.

Release solicitado para `stage` e, depois das validacoes finais, producao.
