# Verify - frontend-typecheck-fila-agendamento

Data: 2026-09-10
Responsavel: Martiniano Barros
Status: done

Verificacao local em worktree baseada em `origin/stage` (1fea95e9). Sem
mensagem real de WhatsApp, sem acesso a producao e sem mudanca de banco.

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `npx tsc --noEmit -p tsconfig.json` sai 0, saida vazia; antes, 3x TS2322 | ok |
| CA-002 | aceitacao | `npm run lint` sai 0 (`eslint . --max-warnings=0`) | ok |
| CA-003 | aceitacao | `npx vitest run`: 38 arquivos, 257 testes aprovados; `AppointmentQueue.test.tsx` 7/7 | ok |
| CA-004 | aceitacao | `git diff` sem `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error` | ok |
| RF-002 | funcional | fixture anotada com o `Item` exportado pelo componente, nao com copia local | ok |
| RF-005 | funcional | nenhuma assercao de teste alterada; diff toca somente import, `item` e assinatura de `response` | ok |
| NFR-001 | nao funcional | `export type` apagado na compilacao; nenhum byte novo no bundle | ok |
| NFR-003 | nao funcional | divergencia futura entre `Item` e a fixture passa a falhar no typecheck | ok |

## 2) Testes automatizados executados

Comandos, a partir de `frontend/`:

```bash
npx tsc --noEmit -p tsconfig.json   # exit 0, saida vazia
npm run lint                        # exit 0
npx vitest run                      # exit 0
```

Resumo dos resultados:
- Backend: nao executado; nenhum arquivo de `backend/` foi tocado.
- Frontend: typecheck limpo (era 3 erros TS2322 nas linhas 9 e 15 do teste);
  lint limpo com `--max-warnings=0`; 257 testes aprovados em 38 arquivos, em
  ~6,6 s. Execucao isolada de `app/whatsapp-stage/AppointmentQueue.test.tsx`:
  7 de 7 aprovados.
- `git diff --check` aprovado.

Baseline: em `origin/stage` puro os testes ja passavam em runtime, porque o
vitest transpila via esbuild e descarta os tipos sem verifica-los. Somente
`tsc` reprovava. Por isso a quebra so aparece no comando que nenhum workflow
de PR executa.

## 3) Testes manuais

Nao se aplica. A mudanca nao altera runtime: uma palavra-chave `export` em uma
declaracao de tipo e anotacoes de tipo no arquivo de teste. O comportamento da
fila de agendamento e integralmente exercitado pelos sete casos automatizados,
incluindo o destaque de horario preferido e sua retirada apos nova correcao.

## 4) Regressao e riscos residuais

- Risco residual 1: outras fixtures de `app/whatsapp-stage/` continuam sem
  amarracao ao contrato do componente e podem repetir o padrao `never[]`.
  Fora de escopo aqui; o gate de CI proposto detectaria a proxima ocorrencia.
- Risco residual 2: enquanto nao houver `frontend-ci.yml`, um typecheck
  quebrado pode chegar a `stage` de novo pelo mesmo caminho. Proposta
  registrada em `spec.md`, secao 5, e na descricao do PR.

## 5) Itens fora de escopo entregues

- Nenhum. O gate de CI foi apenas proposto; `.github/workflows/` nao foi
  alterado neste diff.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao (segue pelo PR de promocao `stage -> main`).
- [ ] Nao aprovado.
