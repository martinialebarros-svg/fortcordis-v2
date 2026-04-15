# Verify - frontend-dashboard-shell-lazy-load

Data: 2026-04-14  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `npm run build` e `npm run analyze` concluidos com sucesso no frontend | ok |
| CA-002 | aceitacao | `agenda/fullcalendar` caiu de `154 kB` para `151 kB` de `First Load JS` | ok |
| CA-003 | aceitacao | `atendimento` caiu de `177 kB` para `174 kB` de `First Load JS` | ok |
| CA-004 | aceitacao | `dashboard` caiu de `139 kB` para `137 kB` de `First Load JS` | ok |
| CA-005 | aceitacao | smoke test registrado em `docs/SMOKE-TEST-DASHBOARD-SHELL-LAZY-LOAD.md` e executado com sucesso pelo usuario | ok |
| NFR-001 | nao funcional | reducao observada nas rotas protegidas apos extracao lazy do shell | ok |
| NFR-002 | nao funcional | sem alteracao de contrato de backend, sessao ou autenticacao | ok |
| NFR-003 | nao funcional | evidencias disponiveis via `build`, `analyze` e checklist de smoke test | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# frontend
npm run analyze
npm run build
```

Resumo dos resultados:
- Backend: nao aplicavel neste ciclo.
- Frontend: `build` e `analyze` concluidos com sucesso.

## 3) Testes manuais

- Cenario 1: login e navegacao entre `/dashboard`, `/agenda`, `/agenda/fullcalendar` e `/atendimento`.
- Cenario 2: uso da sidebar em desktop e mobile.
- Cenario 3: fluxo de Fortinho em tela que usa `useFortinho`, incluindo `Ocultar` e `Mostrar`.
- Cenario 4: validacao de push notifications e tratamento de URL com `push_snooze`.
- Cenario 5: abrir/fechar modais para confirmar limpeza de overlays orfaos.
- Resultado: smoke test executado com sucesso pelo usuario.
- Referencia: `docs/SMOKE-TEST-DASHBOARD-SHELL-LAZY-LOAD.md`.

## 4) Regressao e riscos residuais

- Risco residual 1: o `First Load JS shared by all` segue dominado por runtime de framework e permaneceu em `103 kB`.
- Risco residual 2: cenarios reais de push em stage/producao ainda dependem de validacao no ambiente implantado.

## 5) Itens fora de escopo entregues

- Isolamento lazy do bootstrap de push em chunk proprio.
- Isolamento lazy do handler de `push_snooze` e da limpeza de overlays do shell.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
