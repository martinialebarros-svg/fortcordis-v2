# Verify - atendimento-anexo-pdf-preview-csp

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `curl -s -D - http://localhost:3002/ -o /dev/null` mostra `Content-Security-Policy: ... frame-src 'self' blob: ...` | ok |
| CA-002 | aceitacao | Blob PDF + `blob:` URL injetada em `<iframe>` na mesma origem do dev server; console sem violacao de CSP; `iframe.contentWindow` acessivel | ok |
| CA-003 | aceitacao | Diff de `frontend/next.config.js` mostra apenas uma linha adicionada (`frame-src 'self' blob:`), nenhuma outra diretiva alterada | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend
# nao aplicavel - mudanca restrita a frontend/next.config.js

# frontend
# nao aplicavel - mudanca de config estatica, sem cobertura de teste
# automatizado de headers HTTP no momento
```

Resumo dos resultados:
- Backend: nao aplicavel (nenhum arquivo backend alterado).
- Frontend: nenhum teste automatizado cobre headers de CSP hoje; a
  verificacao foi manual (ver secao 3).

## 3) Testes manuais

- Cenario 1: subir `next dev` local (porta 3002) e checar via
  `curl -D -` que o header `Content-Security-Policy` da resposta inclui
  `frame-src 'self' blob:`. Resultado: presente.
- Cenario 2: no navegador, na mesma origem do dev server, criar
  `new Blob([...], {type: 'application/pdf'})`, gerar
  `URL.createObjectURL(blob)` e injetar `<iframe src={blobUrl}>` no DOM.
  Resultado: iframe renderiza (`contentWindow` acessivel), console sem
  mensagem de "Framing ... violates ... Content Security Policy".
- Cenario 3: fluxo completo (login -> atendimento real -> anexo PDF ->
  clicar "Visualizar" -> ver PDF no modal) nao foi executado nesta sessao -
  exigiria subir o backend (dependencias Python nao instaladas neste
  ambiente, sem dado seedado com anexo PDF real). O mecanismo verificado no
  Cenario 2 e o mesmo exato que bloqueava esse fluxo (framing de `blob:`
  sob esta CSP), entao a cobertura e equivalente para este bug especifico.

## 4) Regressao e riscos residuais

- Risco residual 1: o fluxo completo end-to-end (Cenario 3) fica pendente
  de validacao manual em ambiente com backend rodando antes do deploy.

## 5) Itens fora de escopo entregues

Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
