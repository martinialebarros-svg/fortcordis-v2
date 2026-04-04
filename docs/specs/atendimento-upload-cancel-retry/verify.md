# Verify - atendimento-upload-cancel-retry

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | botao de cancelar upload geral implementado | pending-manual |
| CA-002 | aceitacao | botao de cancelar upload por exame implementado | pending-manual |
| CA-003 | aceitacao | reset de progresso/loading apos cancelamento | pending-manual |
| CA-004 | aceitacao | arquivo mantido para reenvio apos cancelamento | pending-manual |
| CA-005 | aceitacao | lint da tela `app/atendimento/page.tsx` | ok |

## 2) Testes automatizados executados

Comando executado:

```bash
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resultado:
- Frontend lint: sem warnings/erros.

## 3) Testes manuais

- Local:
- [ ] Upload geral: iniciar envio e cancelar no meio.
- [ ] Upload geral: reenviar o mesmo arquivo apos cancelar.
- [ ] Upload de exame: iniciar envio e cancelar no meio.
- [ ] Upload de exame: reenviar o mesmo arquivo apos cancelar.
- [ ] Validar toast `Upload cancelado.` sem erro vermelho.

- Stage:
- [ ] Repetir os 5 cenarios acima em `stage.fortcordis.com.br`.

## 4) Regressao e riscos residuais

- Risco residual 1: cancelamento muito rapido pode nao renderizar barra antes do abort.
- Risco residual 2: ambientes com comportamento divergente de `AbortController`.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Pendente checklist manual local/stage para confirmar CA-001..CA-004.
