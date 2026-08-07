# Verify - atendimento-race-conditions-save-documento

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | leitura de codigo: `mergeAutoSavedFormState` preserva `{...current}` exceto id/exames/prescricao_itens (campos de texto simples nunca sobrescritos) | ok (algoritmo, ja em uso real pelo autosave) |
| CA-002 | aceitacao | leitura de codigo: mesmo pos-processamento de exames do branch de autosave (filtra `_destroy`, garante `[emptyExam()]`) | ok (algoritmo) |
| CA-003 | aceitacao | prova determinística secao 2 (guard sincrono bloqueia a segunda chamada concorrente) | ok |
| CA-004 | aceitacao | `finally` reseta o ref em toda saida - garantido pela semantica de try/finally do JS | ok (por construcao da linguagem) |
| CB-001 | caso de borda | `finally` roda mesmo com `return null` dentro do `try` | ok (semantica do JS) |
| CB-002 | caso de borda | `finally` roda mesmo com excecao lancada | ok (semantica do JS) |
| NFR-001 | correcao | diff line-by-line: nenhum branch de sucesso/erro alterado, so a ordem do guard | ok |
| NFR-002 | raio de mudanca | diff de ~15 linhas em `page.tsx`, nenhuma mudanca de assinatura | ok |

## 2) Verificacao determinística do guard de reentrancia (#19)

O guard de `salvarDocumentoClinico`/`criarDocumentoClinicoDeTemplate` e
estruturalmente identico ao guard de `saveAtendimento`
(`salvamentoAtendimentoEmVooRef`), ja provado deterministicamente em
`docs/specs/atendimento-condicoes-corrida-frontend/verificacao/`. Reexecutei
a mesma tecnica isolando o padrao especifico deste pacote (boolean-ref,
sem a recursao de retry que `saveAtendimento` tem - aqui a segunda chamada
simplesmente desiste, nao refaz):

```bash
node verifica_guard_documento_e_contagem_upload.mjs
```

Resultado: duas chamadas disparadas na mesma sincronia (`Promise.all`)
resultam em exatamente 1 execucao real e 1 bloqueio - nunca duas execucoes
concorrentes. Script comitado em
`docs/specs/atendimento-feedback-erros-frontend/verificacao/` (compartilhado
com achado #29 do mesmo lote de verificacao - ver aquele verify.md).

## 3) Testes automatizados executados

Comandos:

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npm run lint

cd ../backend
./venv/bin/python -m pytest tests/ -q --no-header
```

Resumo dos resultados:
- Frontend: `tsc` sem erros; `eslint --max-warnings=0` sem erros/warnings.
- Backend (suite completa): 673 passed, 0 failed - confirma isolamento
  (nenhuma rota de API afetada, feature 100% frontend).

## 4) Testes manuais

Nao executados nesta sessao - mesma limitacao de ambiente de automacao de
navegador documentada em
`docs/specs/atendimento-condicoes-corrida-frontend/verify.md` (secao 4).

- CA-001/CA-002: risco residual BAIXO. `mergeAutoSavedFormState` e a mesma
  funcao que o autosave usa em produção, sem modificacao - a mudanca desta
  feature e apenas CHAMAR essa funcao de um segundo lugar, nao alterar seu
  comportamento.
- CA-003: risco residual BAIXO. Mesmo padrao de guard sincrono ja usado e
  documentado para `salvamentoAtendimentoEmVooRef`, agora com prova
  determinística dedicada tambem.

## 5) Regressao e riscos residuais

- Risco residual 1: confirmacao visual no navegador (digitar durante um
  save manual em voo; duplo clique real em "Salvar documento") nao foi
  feita nesta sessao, pela mesma instabilidade de ambiente ja documentada.
- Risco residual 2 (aceito, ver intent.md secao 3): `finalizarAtendimento`
  mantem seu proprio `setForm(hydrated)` incondicional, fora do escopo
  deste achado.

## 6) Itens fora de escopo entregues

Nenhum.

## 7) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
